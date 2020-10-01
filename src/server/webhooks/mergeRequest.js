// @flow
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';
import type { WebhookProcessResponseType } from './queue';
import { jiraRequest } from '../apis/jira';
import linkIssues from './linkIssues';
import type { WebhookMetadataType } from '../apis/webhooks.types';
import sendDevInfo from './sendDevInfo';
import { getWebhookSettings } from './settings';
import { processCommitsForJiraDevInfo, processCommits } from './commits';
import { parseMarkdown } from './linkIssues';

export const jiraIssueGlancePropertyKey =
  'com.atlassian.jira.issue:gitlab-seneschal:gitlab-seneshal-merge-requests-glance:status';

async function updateMergeRequestIssueProperty(jiraApi, issueKey, meta) {
  try {
    const gitlabProperty = await jiraRequest(
      jiraApi,
      'get',
      `/issue/${issueKey}/properties/${jiraIssueGlancePropertyKey}`
    );
    let updatedProperty = {
      type: 'badge',
      value: {
        label: 0
      },
      mergeRequests: []
    };
    if (gitlabProperty.value) {
      updatedProperty = gitlabProperty.value;
    }
    const existingMergeRequest = updatedProperty.mergeRequests.find(
      (mr) => mr.key === meta.key
    );
    if (!existingMergeRequest) {
      updatedProperty.mergeRequests.push(meta);
      updatedProperty.value.label += 1;
    } else {
      updatedProperty.mergeRequests.splice(
        updatedProperty.mergeRequests.indexOf(existingMergeRequest),
        1,
        meta
      );
    }
    await jiraRequest(
      jiraApi,
      'put',
      `/issue/${issueKey}/properties/${jiraIssueGlancePropertyKey}`,
      updatedProperty
    );
  } catch (error) {
    console.error('set property error', error);
  }
}

const gitlabJiraLinksHeader = '<summary>All Jira Seneschal Links</summary>';
const gitlabJiraLinksHeaderRegexp = gitlabJiraLinksHeader.replace(
  /\//gi,
  '\\/'
);

// This should be replaced once https://gitlab.com/gitlab-org/gitlab-ce/issues/48508 is done
/*
<details>
  <summary>All Jira Seneschal Links</summary>

  | Ticket | Title |
  | --- | --- |
  | [TC-132](http://jira.com) | Some ticket one |
  | [TS-12](http://jira.com) | Some other ticket |
</details>
*/

async function buildGitlabLinksSummary(
  jiraApi: *,
  baseUrl: string,
  issueKeys: string[]
): Promise<string> {
  if (issueKeys.length === 0) return '';
  const issueData = await jiraRequest(
    jiraApi,
    'get',
    `/search?jql=issuekey in (${issueKeys.join(',')})&fields=issuetype,summary`
  );
  const issueTableContent = (issueData.issues || []).map((issue) => {
    return `| [${issue.key}](${baseUrl}/browse/${issue.key}) | ${issue.fields.summary} |`;
  });
  return `<details>
  ${gitlabJiraLinksHeader}
  
  | Ticket | Title |
  | --- | --- |
  ${issueTableContent.join('\n  ')}
</details>`;
}

export default async function processWebhookMergeRequest(
  jiraApi: *,
  jiraAddon: *,
  clientKey: string,
  gitlabApi: *,
  baseJiraUrl: string,
  jiraProjectIds: string[],
  metadata: WebhookMetadataType,
  response: WebhookProcessResponseType,
  hookData?: * = {},
  queueElementId: number
) {
  const settings = await getWebhookSettings(jiraAddon, clientKey);
  const { enableUpdateOnEdits, useDescriptionTransitions } = Object.keys(
    settings
  ).reduce((result, key) => {
    result[key] = settings[key];
    if (result[key] === 'true') result[key] = true;
    if (result[key] === 'false') result[key] = false;
    return result;
  }, {});
  const { changes } = hookData;
  let isWip = false;
  if (changes && changes.title) {
    const wipRegExp = /^WIP:/;
    isWip = wipRegExp.test(changes.title.current);
  }
  const action = response.action === 'reopen' ? 'open' : response.action;
  const mrData = await gitlabApi.MergeRequests.show(
    response.projectId,
    response.mergeRequestId
  );
  const { id, description, title, state, web_url: mergeRequestUrl } = mrData;
  const commits = await gitlabApi.MergeRequests.commits(
    response.projectId,
    response.mergeRequestId
  );
  const { transitionKeywords, transitionMap, defaultTransitionMap } = metadata;
  const commitIssues = processCommits(
    transitionKeywords,
    jiraProjectIds,
    commits
  );

  if (useDescriptionTransitions) {
    commitIssues.push(
      ...processCommits(transitionKeywords, jiraProjectIds, [
        {
          title,
          message: parseMarkdown(jiraProjectIds, baseJiraUrl, description)
            .map(({ text }) => text)
            .join('')
        }
      ])
    );
  }

  const seneschalUser = await gitlabApi.Users.current();
  if (
    action === 'update' &&
    (!enableUpdateOnEdits ||
      hookData.object_attributes.last_edited_by_id === seneschalUser.id)
  ) {
    return;
  }

  if (action !== 'update') {
    const issuesToTransition = uniqBy(
      commitIssues.filter((commitIssue) => commitIssue.shouldTransition),
      ({ issueKey }) => issueKey
    );
    await Promise.all(
      issuesToTransition.map(async ({ issueKey }) => {
        const [projectKey] = issueKey.split('-');
        const transitionStatusProject =
          transitionMap.find(
            ({ jiraProjectKey, [`${action}StatusIds`]: statusIds }) =>
              jiraProjectKey === projectKey && statusIds && statusIds.length
          ) ||
          defaultTransitionMap[0] ||
          {};
        const transitionStatusIds =
          transitionStatusProject[`${action}StatusIds`];
        if (transitionStatusIds && transitionStatusIds.length) {
          for (let i = 0; i < transitionStatusIds.length; i += 1) {
            try {
              const issueTransitions = await jiraRequest(
                jiraApi,
                'get',
                `/issue/${issueKey}/transitions`
              );
              const transition = issueTransitions.transitions.find(
                (t) => t.to.id === transitionStatusIds[i]
              );
              if (transition) {
                const transitionAttempt = await jiraRequest(
                  jiraApi,
                  'post',
                  `/issue/${issueKey}/transitions`,
                  {
                    transition: {
                      id: transition.id
                    }
                  }
                );
                if (!transitionAttempt || !transitionAttempt.errors) {
                  // This is a successful attempt, don't try any more transitions
                  break;
                }
              }
            } catch (error) {
              // This is not really an error per say, it's just not good enough to fail us.
              // Maybe it hasn't been setup to pick up transitions on this project yet
              console.error('failed transition', error);
            }
          }
        }
      })
    );
  }

  const { issues: mrIssues, newText } = linkIssues(
    jiraProjectIds,
    baseJiraUrl,
    description
  );

  const baseIssuePropertyMeta = {
    mergeRequestUrl,
    projectNamespace: response.projectNamespace,
    id,
    title,
    status: isWip ? 'in progress' : state,
    approvers: []
  };

  if (action === 'merge') {
    const approvals = await gitlabApi.MergeRequests.approvals(
      response.projectId,
      { mergeRequestId: response.mergeRequestId }
    );
    if (approvals && approvals.approved_by) {
      approvals.approved_by.forEach(async (user) => {
        let approvalUser = { name: user.name };
        const gitlabUser = await gitlabApi.Users.search(user.username);
        if (gitlabUser.email) {
          const foundUser = await jiraRequest(
            jiraApi,
            'get',
            `/user/search?query=${gitlabUser.email}`
          );
          approvalUser = foundUser;
        } else {
          approvalUser = {
            key: gitlabUser.id,
            name: gitlabUser.name,
            avatar: gitlabUser.avatar_url
          };
        }
        baseIssuePropertyMeta.approvers.push(approvalUser);
      });
    }
  }

  // states are: merged opened closed locked
  const textIssues = uniq(mrIssues.concat(response.issues || [])).filter(
    (issueKey) =>
      !commitIssues.find(
        ({ issueKey: commitIssueKey }) => commitIssueKey === issueKey
      )
  );

  const newSummary = await buildGitlabLinksSummary(
    jiraApi,
    baseJiraUrl,
    textIssues.concat(commitIssues.map((val) => val.issueKey))
  );

  let newMergeRequestDescription;
  const replacementRegexp = new RegExp(
    `<details>[^<]+${gitlabJiraLinksHeaderRegexp}[^<]+<\\/details>`,
    'mig'
  );
  if (newText && newText.match(replacementRegexp)) {
    newMergeRequestDescription = newText.replace(replacementRegexp, newSummary);
  } else if (
    !newText &&
    new RegExp(gitlabJiraLinksHeaderRegexp).test(description)
  ) {
    newMergeRequestDescription = description.replace(
      replacementRegexp,
      newSummary
    );
  } else {
    newMergeRequestDescription = `${newText || description}\n\n${newSummary}`;
  }

  if (newMergeRequestDescription.trim() !== description.trim()) {
    await gitlabApi.MergeRequests.edit(
      response.projectId,
      response.mergeRequestId,
      {
        description: newMergeRequestDescription
      }
    );
  }

  textIssues.forEach(async (issueKey: string) => {
    try {
      await updateMergeRequestIssueProperty(jiraApi, issueKey, {
        ...baseIssuePropertyMeta,
        key: response.mergeRequestId,
        relationship: 'reference'
      });
    } catch (error) {
      console.error('set property error', error);
    }
  });
  commitIssues.forEach(async ({ issueKey, shouldTransition }) => {
    try {
      await updateMergeRequestIssueProperty(jiraApi, issueKey, {
        ...baseIssuePropertyMeta,
        key: response.mergeRequestId,
        relationship: shouldTransition ? 'transitions' : 'reference'
      });
    } catch (error) {
      console.error('remote link error', error);
    }
  });

  // This timestamp doesn't include seconds / milliseconds
  const updateSequenceId =
    new Date(hookData.object_attributes.updated_at).getTime() + queueElementId;
  const prStatusMap = {
    merged: 'MERGED',
    opened: 'OPEN',
    closed: 'DECLINED',
    locked: 'UNKNOWN'
  };
  const author = await gitlabApi.Users.show(mrData.author.id);
  const approvalState = await gitlabApi.MergeRequests.approvalState(
    response.projectId,
    response.mergeRequestId
  );

  const devInfoCommits = await processCommitsForJiraDevInfo(
    gitlabApi,
    updateSequenceId,
    metadata,
    jiraProjectIds,
    hookData.project,
    commits
  );

  await sendDevInfo(jiraAddon, clientKey, baseJiraUrl, {
    updateSequenceId,
    project: hookData.project,
    commits: devInfoCommits,
    branches: [],
    pullRequests: [
      {
        id: `${id}`,
        issueKeys: uniq(
          textIssues.concat(commitIssues.map(({ issueKey }) => issueKey))
        ),
        updateSequenceId,
        status: prStatusMap[state],
        title,
        author: {
          name: author.name,
          email: author.email || author.public_email
        },
        commentCount: mrData.user_notes_count,
        sourceBranch: mrData.source_branch,
        sourceBranchUrl: `${hookData.project.web_url}/tree/${mrData.source_branch}`,
        lastUpdate: mrData.updated_at,
        destinationBranch: mrData.target_branch,
        reviewers: (approvalState.rules || []).reduce((approvers, rule) => {
          const allApprovers = rule.eligible_approvers
            .concat(rule.users)
            .map((a) => ({ ...a, approvalStatus: 'UNAPPROVED' }));
          const newApprovers = rule.approved_by.map((person) => ({
            ...person,
            approvalStatus: 'APPROVED'
          }));
          const uniquedApprovers = uniqBy(
            newApprovers.concat(allApprovers),
            ({ id }) => id
          );
          return approvers.concat(
            uniquedApprovers.map((a) => ({
              name: a.name,
              url: a.web_url,
              avatar: a.avatar_url,
              approvalStatus: a.approvalStatus || 'UNAPPROVED'
            }))
          );
        }, []),
        url: mrData.web_url,
        displayId: mrData.references.full
      }
    ]
  });
}
