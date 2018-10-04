// @flow
import filter from 'lodash/filter';
import kebabCase from 'lodash/kebabCase';
import uniqueBy from 'lodash/uniqBy';
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
import transitionProjectApi from '../apis/transitionProject';

function transformLabels(labels: string[]) {
  return labels.map((label) => {
    const specialCharacterFixed = label.replace(/ ([^a-z0-9]) /gi, '$1');
    return kebabCase(specialCharacterFixed);
  });
}

export default async function createJiraIssue(
  encryptionKey: string,
  jiraApi: *,
  jiraBaseUrl: string,
  gitlabProjectId: string,
  gitlabIssueIid: string,
  logger: (message: string) => void
) {
  const gitlabApi = GitlabApi(encryptionKey);

  const transitionProjectDb = transitionProjectApi(
    encryptionKey,
    gitlabProjectId
  );

  const mapping: TransitionMappingType = transitionProjectDb
    .get('mapping')
    .value();

  const issue = transitionProjectDb
    .get('issues')
    .find({ iid: gitlabIssueIid })
    .value();
  if (!issue) return;
  logger('Issue Loaded, starting processing...');

  const { labels, title, state, description, milestone, author } = issue;

  const components = mapping.baseValues.components || [];
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
      mapping.issueTypes,
      label
    );
    const foundJiraStatus: ?TransitionMappingStatusType = findGitlabLabel(
      mapping.statuses,
      label
    );
    const foundJiraComponent: ?TransitionMappingComponentType = findGitlabLabel(
      mapping.components,
      label
    );
    const foundJiraPriority: ?TransitionMappingPriorityType = findGitlabLabel(
      mapping.priorities,
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
      components.push({ id: foundJiraComponent.componentId });
    }
    if (!foundLabelIssueType && !foundJiraStatus && !foundJiraComponent) {
      remainingLabels.push(label);
    }
    return remainingLabels;
  }, []);

  if (mapping.statuses && mapping.statuses.length) {
    jiraStatus = mapping.statuses.find(
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
    const version = mapping.versions.find(
      (versionMap) => versionMap.milestoneId === milestone.id
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
      project: mapping.baseValues.project,
      issuetype: {
        id: issueTypeId
      },
      priority: jiraPriority,
      labels: transformLabels(otherLabels),
      summary: title,
      fixVersions,
      components: uniqueBy(components, 'id'),
      description: {
        type: 'doc',
        version: 1,
        content
      }
    }
  });
  const jiraIssue = jiraIssueCreateResponse;

  await gitlabApi.Issues.edit(gitlabProjectId, gitlabIssueIid, {
    description: `Migrated to: [${jiraIssue.key}](${jiraBaseUrl}/browse/${
      jiraIssue.key
    })\n\n  ${description}`
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
