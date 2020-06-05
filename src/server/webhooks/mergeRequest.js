// @flow
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';
import type { WebhookProcessResponseType } from './queue';
import { jiraRequest } from '../apis/jira';
import linkIssues from './linkIssues';
import type { WebhookMetadataType } from '../apis/webhooks.types';
import sendDevInfo from './sendDevInfo';

function extractTickets(regex: string, search: string) {
  const tickets = [];
  const regexp = new RegExp(regex, 'ig');
  let currentMatch;
  while ((currentMatch = regexp.exec(search))) {
    tickets.push(currentMatch[1]);
  }
  return tickets;
}

export function processCommits(
  transitionKeywords: string[],
  jiraProjectKeys: string[],
  commits: { title: string, message: string }[]
): { issueKey: string, shouldTransition: boolean }[] {
  const looseMatchRegexString = `((?:${transitionKeywords.join(
    '|'
  )}|,| and )[ ])*((?:(?:(?:${jiraProjectKeys.join(
    '|'
  )})-[1-9][0-9]*)(?:|(?:,| and) )+)+)`;
  const ticketMatchRegexString = `(?:^|\\s)((?:${jiraProjectKeys.join(
    '|'
  )})-[1-9][0-9]*)`;
  const issueMatches = commits.reduce(
    (matches: { [string]: boolean }, commit) => {
      let currentMatch;
      const regexp = new RegExp(looseMatchRegexString, 'ig');
      while ((currentMatch = regexp.exec(commit.title))) {
        const isTransition = Boolean(currentMatch[1]);
        extractTickets(ticketMatchRegexString, currentMatch[2]).forEach(
          (ticketKey) => {
            matches[ticketKey] = matches[ticketKey] || isTransition;
          }
        );
      }
      while ((currentMatch = regexp.exec(commit.message))) {
        const isTransition = Boolean(currentMatch[1]);
        extractTickets(ticketMatchRegexString, currentMatch[2]).forEach(
          (ticketKey) => {
            matches[ticketKey] = matches[ticketKey] || isTransition;
          }
        );
      }
      return matches;
    },
    {}
  );
  return Object.keys(issueMatches).map((key) => ({
    issueKey: key,
    shouldTransition: issueMatches[key]
  }));
}

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
) {
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
  const { changes } = hookData;
  let wasWip = false;
  let isWip = false;
  if (changes && changes.title) {
    const wipRegExp = /^WIP:/;
    wasWip = wipRegExp.test(changes.title.previous);
    isWip = wipRegExp.test(changes.title.current);
  }
  if (
    !(
      response.action === 'merge' ||
      response.action === 'open' ||
      response.action === 'reopen' ||
      response.action === 'close'
    ) &&
    wasWip === isWip
  )
    return;
  const action = response.action === 'reopen' ? 'open' : response.action;
  const mrData = await gitlabApi.MergeRequests.show(
    response.projectId,
    response.mergeRequestId
  );
  const { id, description, title, state, web_url: mergeRequestUrl } = mrData;
  if (isWip !== wasWip && state !== 'opened' && response.action === 'update') {
    return;
  }
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

  if (action !== 'update') {
    const issuesToTransition = commitIssues.filter(
      (commitIssue) => commitIssue.shouldTransition
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

  if (action !== 'update') {
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
      newMergeRequestDescription = newText.replace(
        replacementRegexp,
        newSummary
      );
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

  await sendDevInfo(jiraAddon, clientKey, baseJiraUrl, {
    updateSequenceId,
    project: hookData.project,
    commits: await commits.reduce(async (linkedCommits, commit) => {
      const thisCommitIssues = processCommits(
        transitionKeywords,
        jiraProjectIds,
        [commit]
      );
      if (thisCommitIssues.length) {
        const diffs = await gitlabApi.Commits.diff(
          hookData.project.id,
          commit.id
        );
        linkedCommits.push({
          id: commit.id,
          issueKeys: thisCommitIssues.map((i) => i.issueKey),
          updateSequenceId,
          hash: commit.id,
          message: commit.message,
          author: {
            name: commit.author_name,
            email: commit.author_email
          },
          fileCount: diffs.length,
          url: `${hookData.project.web_url}/commits/${commit.id}`,
          files: diffs.map((diff) => ({
            path: diff.new_path,
            url: `${hookData.project.web_url}/blob/${
              commit.id
            }/${diff.new_path || diff.old_path}`,
            changeType:
              diff.new_file && diff.old_path
                ? 'COPIED'
                : diff.new_file
                ? 'ADDED'
                : diff.renamed_file
                ? 'MOVED'
                : diff.deleted_file
                ? 'DELETED'
                : diff.new_path !== diff.old_path
                ? 'MOVED'
                : 'MODIFIED',
            ...diff.diff
              .replace(/@@/gi, '\n@@')
              .split('\n')
              .reduce(
                (result, string) => {
                  if (string[0] === '-') result.linesRemoved += 1;
                  else if (string[0] === '+') result.linesAdded += 1;
                  return result;
                },
                { linesRemoved: 0, linesAdded: 0 }
              )
          })),
          authorTimestamp: commit.created_at,
          displayId: commit.short_id
        });
      }
      return linkedCommits;
    }, []),
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
