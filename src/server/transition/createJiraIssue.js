// @flow
import filter from 'lodash/filter';
import kebabCase from 'lodash/kebabCase';
import unique from 'lodash/uniq';
import markdownTransform from './markdownTransform';
import GitlabApi from '../apis/gitlab';
import type {
  TransitionMappingComponentType,
  TransitionMappingIssueTypeType,
  TransitionMappingPriorityType,
  TransitionMappingStatusType,
  TransitionMappingType
} from './types';
import { jiraRequest } from '../apis/jira';
import type { DatabaseType } from '../models';

function transformLabels(labels: string[]) {
  return labels.map((label) => {
    const specialCharacterFixed = label.replace(/ ([^a-z0-9]) /gi, '$1');
    return kebabCase(specialCharacterFixed);
  });
}

export default async function createJiraIssue(
  database: DatabaseType,
  jiraApi: *,
  jiraBaseUrl: string,
  gitlabProjectId: string,
  gitlabIssueIid: string,
  logger: (message: string) => void
) {
  const gitlabApi = await GitlabApi(database);

  const mappingQueryOptions = {
    where: {
      projectId: gitlabProjectId
    }
  };

  const mapping: TransitionMappingType = await database.MigrationMappings.findOne(
    mappingQueryOptions
  );

  const issue = await database.MigrationIssues.findOne({
    where: {
      projectId: gitlabProjectId,
      iid: gitlabIssueIid
    }
  });

  const mappingIssueTypes = await database.MigrationMappingIssueTypes.findAll(
    mappingQueryOptions
  );
  const mappingStatuses = await database.MigrationMappingStatuses.findAll(
    mappingQueryOptions
  );
  const mappingComponents = await database.MigrationMappingComponents.findAll(
    mappingQueryOptions
  );
  const mappingPriorities = await database.MigrationMappingPriorities.findAll(
    mappingQueryOptions
  );

  if (!issue) return;
  logger('Issue Loaded, starting processing...');

  const { labels, title, state, description, milestone, author } = issue;

  const components = [...mapping.defaultComponentIds] || [];
  let labelIssueType: ?TransitionMappingIssueTypeType;
  let jiraStatus: ?{ statusId: string };
  let jiraPriority;

  function findGitlabLabel<T>(array: any[], label): T | void {
    if (!array || !array.length) return;
    return array.find(({ gitlabLabel }) => label === gitlabLabel);
  }

  logger('Start processing labels.');

  const otherLabels = labels.reduce((remainingLabels, label) => {
    const foundLabelIssueType: ?TransitionMappingIssueTypeType = findGitlabLabel(
      mappingIssueTypes,
      label
    );
    const foundJiraStatus: ?TransitionMappingStatusType = findGitlabLabel(
      mappingStatuses,
      label
    );
    const foundJiraComponent: ?TransitionMappingComponentType = findGitlabLabel(
      mappingComponents,
      label
    );
    const foundJiraPriority: ?TransitionMappingPriorityType = findGitlabLabel(
      mappingPriorities,
      label
    );
    if (foundLabelIssueType) {
      labelIssueType = foundLabelIssueType;
    }
    if (foundJiraStatus) {
      jiraStatus = foundJiraStatus;
    }
    if (foundJiraPriority) {
      jiraPriority = { id: foundJiraPriority.priorityId };
    }
    if (foundJiraComponent) {
      components.push(foundJiraComponent.componentId);
    }
    if (!foundLabelIssueType && !foundJiraStatus && !foundJiraComponent) {
      remainingLabels.push(label);
    }
    return remainingLabels;
  }, []);

  if (mappingStatuses.length) {
    jiraStatus = mappingStatuses.find(
      ({ gitlabLabel, issueTypeId }) =>
        labelIssueType && issueTypeId === labelIssueType
          ? labelIssueType.issueTypeId
          : mapping.defaultIssueTypeId &&
            labels.find((label) => label === gitlabLabel)
    );
  }

  let issueTypeId = mapping.defaultIssueTypeId;
  if (labelIssueType) {
    issueTypeId = labelIssueType.issueTypeId;
  }

  logger('Map milestones to versions.');

  let fixVersions;
  if (milestone && milestone.id) {
    const mappingVersions = await database.MigrationMappingVersions.findAll(
      mappingQueryOptions
    );
    const version = mappingVersions.find(
      (versionMap) => versionMap.milestoneId === `${milestone.id}`
    );
    if (version) {
      fixVersions = [
        {
          id: version.versionId
        }
      ];
    }
  }

  let comments = [];
  try {
    const notes = await gitlabApi.IssueNotes.all(
      gitlabProjectId,
      gitlabIssueIid
    );
    comments = filter(notes, ({ system }) => !system);
  } catch (error) {
    // no notes causes error for some reason.
    console.error(error);
  }

  logger('Create Jira issue.');

  // Create Issue in Jira
  const content = [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `_Gitlab Creator: ${author.name}_`
        }
      ]
    }
  ];

  if (description) {
    content.push({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: await markdownTransform(gitlabApi, gitlabProjectId, description)
        }
      ]
    });
  }

  const jiraIssueCreateResponse = await jiraRequest(jiraApi, 'post', '/issue', {
    fields: {
      project: {
        id: mapping.jiraProjectId
      },
      issuetype: {
        id: issueTypeId
      },
      priority: jiraPriority,
      labels: transformLabels(otherLabels),
      summary: title,
      fixVersions,
      components: unique(components).map((id) => ({ id })),
      description: {
        type: 'doc',
        version: 1,
        content
      }
    }
  });
  const jiraIssue = jiraIssueCreateResponse;
  if (jiraIssue.errors) {
    const errors = Object.keys(jiraIssue.errors).map(
      (key) => `${key}: ${jiraIssue.errors[key]}`
    );
    throw new Error(
      `Failed to create Issue:\n${errors
        .concat(jiraIssue.errorMessages)
        .map((m) => `- ${m}`)
        .join('\n')}`
    );
  }

  await gitlabApi.Issues.edit(gitlabProjectId, gitlabIssueIid, {
    description: `Migrated to: [${jiraIssue.key}](${jiraBaseUrl}/browse/${
      jiraIssue.key
    })\n\n${description}`
  });

  try {
    await jiraRequest(jiraApi, 'post', `/issue/${jiraIssue.key}/remotelink`, {
      globalId: `${jiraIssue.key}=migrated-issue-link`,
      application: {
        type: 'gitlab',
        name: 'GitLab'
      },
      relationship: 'Original Gitlab Issue',
      object: {
        url: issue.web_url,
        title: 'Original GitLab Issue',
        icon: {
          url16x16: 'https://gitlab.kkvesper.net/favicon.ico',
          title: 'Migrated Issue'
        }
      }
    });
  } catch (error) {
    console.error('remote link error', error);
  }

  logger('Create Comments for new issue');

  // Migrate all comments
  for (let i = 0; i < comments.length; i += 1) {
    try {
      await jiraRequest(jiraApi, 'post', `/issue/${jiraIssue.key}/comment`, {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `_Gitlab Creator: ${comments[i].author.name}_`
                }
              ]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: await markdownTransform(
                    gitlabApi,
                    gitlabProjectId,
                    comments[i].body
                  )
                }
              ]
            }
          ]
        }
      });
    } catch (error) {
      console.warn(error);
    }
  }

  logger('Transition Issue to correct state');

  // transition issue to correct state
  let fields;
  if (state === 'closed') {
    jiraStatus = {
      statusId: labelIssueType
        ? labelIssueType.closedStatusId
        : mapping.defaultIssueTypeClosedStatusId
    };
    fields = {
      resolution: {
        id: mapping.defaultResolutionId
      }
    };
  }
  if (jiraStatus) {
    try {
      const jiraTransitionsRequest = await jiraRequest(
        jiraApi,
        'get',
        `/issue/${jiraIssue.key}/transitions`
      );
      const jiraTransitions = jiraTransitionsRequest.transitions;
      const transition = jiraTransitions.find(
        // $FlowFixMe
        ({ to: { id: statusId } }) => statusId === jiraStatus.statusId
      );
      const response = await jiraRequest(
        jiraApi,
        'post',
        `/issue/${jiraIssue.key}/transitions`,
        {
          transition: { id: transition.id },
          fields
        }
      );
      console.log('Status response', response);
    } catch (error) {
      console.warn('Transition Failed', error);
    }
  }

  return jiraIssue;
}
