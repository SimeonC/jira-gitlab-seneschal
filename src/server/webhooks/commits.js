// @flow
import type { WebhookMetadataType } from '../apis/webhooks.types';

export function processCommits(
  transitionKeywords: string[],
  jiraProjectKeys: string[],
  commits: { title: string, message: string }[]
): { issueKey: string, shouldTransition: boolean }[] {
  const ticketMatchRegexString = `(?:^|\\s)((?:${jiraProjectKeys.join(
    '|'
  )})-[1-9][0-9]*)`;
  const issueMatches = commits.reduce(
    (matches: { [string]: boolean }, commit) => {
      const commitLines = [commit.title].concat(commit.message.split('\n'));
      commitLines.forEach((line) => {
        let transitionsAfter = -1;
        const isTransitionMatch = new RegExp(
          `(?:^|\\s)(${transitionKeywords.join('|')})\\b`,
          'ig'
        ).exec(line);
        if (isTransitionMatch) {
          transitionsAfter = isTransitionMatch.index;
        }
        let currentMatch;
        const regexp = new RegExp(ticketMatchRegexString, 'ig');
        while ((currentMatch = regexp.exec(line))) {
          const isTransition =
            transitionsAfter >= 0 && currentMatch.index > transitionsAfter;
          matches[currentMatch[1]] = matches[currentMatch[1]] || isTransition;
        }
      });
      return matches;
    },
    {}
  );
  return Object.keys(issueMatches).map((key) => ({
    issueKey: key,
    shouldTransition: issueMatches[key]
  }));
}

export async function processCommitsForJiraDevInfo(
  gitlabApi: *,
  updateSequenceId: string,
  metadata: WebhookMetadataType,
  jiraProjectIds: string[],
  gitlabProject: { id: string, web_url: string },
  commits: *,
  includeUnmatchedCommits?: boolean
) {
  const parsedCommits = [];
  for (let i = 0; i < commits.length; i += 1) {
    const commit = await gitlabApi.Commits.show(
      gitlabProject.id,
      commits[i].id
    );
    const { transitionKeywords } = metadata;
    const thisCommitIssues = processCommits(
      transitionKeywords,
      jiraProjectIds,
      [commit]
    );
    if (!includeUnmatchedCommits && thisCommitIssues.length === 0) continue;
    const diffs = await gitlabApi.Commits.diff(gitlabProject.id, commit.id);
    const author = commit.author || {
      name: commit.author_name,
      email: commit.author_email
    };
    parsedCommits.push({
      id: commit.id,
      issueKeys: thisCommitIssues.map(({ issueKey }) => issueKey),
      updateSequenceId,
      hash: commit.id,
      message: commit.message,
      author,
      fileCount: diffs.length,
      url: `${gitlabProject.web_url}/commits/${commit.id}`,
      files: diffs.slice(0, 10).map((diff) => ({
        path: diff.new_path,
        url: `${gitlabProject.web_url}/blob/${commit.id}/${
          diff.new_path || diff.old_path
        }`,
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
      authorTimestamp: commit.authored_date,
      displayId: commit.short_id
    });
  }
  return parsedCommits;
}
