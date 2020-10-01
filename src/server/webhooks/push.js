// @flow
import type { WebhookMetadataType } from '../apis/webhooks.types';
import sendDevInfo from './sendDevInfo';
import { processCommitsForJiraDevInfo } from './commits';

export async function processPush(
  jiraAddon: *,
  clientKey: *,
  gitlabApi: *,
  baseJiraUrl: string,
  jiraProjectKeys: string[],
  webhookMetadata: WebhookMetadataType,
  hookData: * = {},
  queueElementId: number
) {
  const lastCommit = hookData.commits[hookData.commits.length - 1];
  const updateSequenceId =
    new Date(lastCommit.timestamp).getTime() + queueElementId;
  const devInfoCommits = await processCommitsForJiraDevInfo(
    gitlabApi,
    updateSequenceId,
    webhookMetadata,
    jiraProjectKeys,
    hookData.project,
    hookData.commits
  );

  let branches = await gitlabApi.Commits.references(
    hookData.project.id,
    lastCommit.id
  );
  branches = await Promise.all(
    branches.map(async ({ type, name }) => {
      const nameParts = name.split(/[^a-zA-Z0-9]/gi);
      const issueKeys = [];
      for (let i = 0; i < nameParts.length; i += 1) {
        if (
          jiraProjectKeys.indexOf(nameParts[i]) >= 0 &&
          i + 1 < nameParts.length &&
          nameParts[i + 1].match(/^[0-9]+$/gi)
        ) {
          issueKeys.push(`${nameParts[i]}-${nameParts[i + 1]}`);
        }
      }
      if (!issueKeys.length) return null;
      const branchData = await gitlabApi.Branches.show(
        hookData.project.id,
        name
      );
      const [lastCommit] = await processCommitsForJiraDevInfo(
        gitlabApi,
        updateSequenceId,
        webhookMetadata,
        jiraProjectKeys,
        hookData.project,
        [branchData.commit],
        true
      );
      return {
        id: `${type}_${name}`,
        name,
        issueKeys,
        updateSequenceId,
        lastCommit,
        createPullRequestUrl: `${hookData.project.web_url}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${name}`,
        url: branchData.web_url
      };
    })
  );

  branches = branches.filter((branch) => !!branch);

  await sendDevInfo(jiraAddon, clientKey, baseJiraUrl, {
    updateSequenceId,
    project: hookData.project,
    commits: devInfoCommits,
    branches,
    pullRequests: []
  });
}
