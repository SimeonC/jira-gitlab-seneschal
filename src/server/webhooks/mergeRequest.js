// @flow
import uniq from 'lodash/uniq';
import startCase from 'lodash/startCase';
import type { WebhookProcessResponseType } from './queue';
import { jiraRequest } from '../apis/jira';
import linkIssues from './linkIssues';
import type { WebhookMetadataType } from '../apis/webhooks';
import { WEBHOOK_ICON_MAP_WIP_KEY } from '../apis/webhooks';
import iconMap from '../../../iconMap.json';

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

function buildRemoteLink({
  relationship,
  issueKey,
  mergeRequestUrl,
  projectNamespace,
  id,
  icon,
  title,
  state
}) {
  const result = {
    globalId: `${issueKey}=${mergeRequestUrl}`,
    application: {
      type: 'gitlab',
      name: 'GitLab'
    },
    relationship,
    object: {
      url: mergeRequestUrl,
      title: `${projectNamespace}-${id}`,
      summary: title,
      icon: {
        url16x16: 'https://gitlab.kkvesper.net/favicon.ico',
        title: 'Merge Request'
      },
      status: {
        resolved: state !== 'opened',
        title: state,
        icon: {
          url16x16: icon,
          title: startCase(state),
          link: mergeRequestUrl
        }
      }
    }
  };
  return result;
}

const gitlabJiraLinksHeader = '<summary>All Jira Seneschal Links</summary>';
const gitlabJiraLinksHeaderRegexp = gitlabJiraLinksHeader.replace(
  /\//gi,
  '\\/'
);

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
    return `| [${issue.key}](${baseUrl}/browse/${issue.key}) | ${
      issue.fields.summary
    } |`;
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
  gitlabApi: *,
  baseJiraUrl: string,
  jiraProjectIds: string[],
  metadata: WebhookMetadataType,
  response: WebhookProcessResponseType,
  changes?: *
) {
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
  const {
    id,
    description,
    title,
    state,
    web_url: mergeRequestUrl
  } = await gitlabApi.MergeRequests.show(
    response.projectId,
    response.mergeRequestId
  );
  if (isWip !== wasWip && state !== 'opened' && response.action === 'update') {
    return;
  }
  const commits = await gitlabApi.MergeRequests.commits(
    response.projectId,
    response.mergeRequestId
  );
  const { transitionKeywords, transitionMap } = metadata;
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
            ({ jiraProjectKey }) => jiraProjectKey === projectKey
          ) || {};
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

  const baseRemoteLink = {
    mergeRequestUrl,
    projectNamespace: response.projectNamespace,
    id,
    title: `[${
      isWip ? WEBHOOK_ICON_MAP_WIP_KEY.toUpperCase() : startCase(state)
    }] ${title}`,
    state,
    icon: iconMap[isWip ? WEBHOOK_ICON_MAP_WIP_KEY : state]
  };
  // states are: merged opened closed locked

  const textIssues = uniq(mrIssues.concat(response.issues)).filter(
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
    if (newText && new RegExp(gitlabJiraLinksHeaderRegexp).test(newText)) {
      newMergeRequestDescription = newText.replace(
        new RegExp(
          `<details>[^<]+${gitlabJiraLinksHeaderRegexp}[^<]+<\\/details>`,
          'ig'
        ),
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
      await jiraRequest(
        jiraApi,
        'post',
        `/issue/${issueKey}/remotelink`,
        buildRemoteLink({
          ...baseRemoteLink,
          relationship: 'Referenced from GitLab Merge Request',
          issueKey
        })
      );
    } catch (error) {
      console.error('remote link error', error);
    }
  });
  commitIssues.forEach(async ({ issueKey, shouldTransition }) => {
    try {
      await jiraRequest(
        jiraApi,
        'post',
        `/issue/${issueKey}/remotelink`,
        buildRemoteLink({
          ...baseRemoteLink,
          relationship: shouldTransition
            ? 'Completed from GitLab Merge Request'
            : 'Referenced from GitLab Merge Request',
          issueKey
        })
      );
    } catch (error) {
      console.error('remote link error', error);
    }
  });
}
