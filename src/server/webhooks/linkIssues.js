export default function linkIssues(
  jiraProjectKeys: string[],
  baseUrl: string,
  text: string
): { issues: string[], newText: ?string } {
  const regexSafeBaseUrl = `${baseUrl}/browse/`.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
  const matchRegex = new RegExp(
    `(^|\\W|\\[|${regexSafeBaseUrl})(${jiraProjectKeys.join(
      '|'
    )})\\-([1-9][0-9]*)($|]\\([^)]+\\)|\\W)`,
    'ig'
  );
  const issues = [];
  const transformedIssues = [];
  const newText = text.replace(
    matchRegex,
    (match, openingMatch, projectKey, issueId, closingMatch) => {
      const issueKey = `${projectKey.toUpperCase()}-${issueId}`;
      if (issues.indexOf(issueKey) === -1) {
        issues.push(issueKey);
      }
      if (openingMatch !== '[' && transformedIssues.indexOf(issueKey) === -1) {
        transformedIssues.push(issueKey);
      }
      if (
        !new RegExp(`${regexSafeBaseUrl}`, 'i').test(openingMatch) &&
        (openingMatch !== '[' || !/^\]\(http[^)]+\)$/i.test(closingMatch))
      ) {
        return `${openingMatch}[${issueKey}](${baseUrl}/browse/${issueKey})${closingMatch}`;
      }
      return `[${issueKey}](${baseUrl}/browse/${issueKey})${
        openingMatch === '[' ? '' : closingMatch
      }`;
    }
  );

  return {
    issues,
    newText: transformedIssues.length ? newText : null
  };
}
