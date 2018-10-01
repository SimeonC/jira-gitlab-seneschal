export default function linkIssues(
  jiraProjectKeys: string[],
  baseUrl: string,
  text: string
): { issues: string[], newText: string } {
  const matchRegex = new RegExp(
    `(^|\\W|\\[)(${jiraProjectKeys.join(
      '|'
    )})\\-([1-9][0-9]*)($|]\\([^)]+\\)|\\W)`,
    'ig'
  );

  const issues = [];
  const newText = text.replace(
    matchRegex,
    (match, openingMatch, projectKey, issueId, closingMatch) => {
      const issueKey = `${projectKey.toUpperCase()}-${issueId}`;
      if (issues.indexOf(issueKey) === -1) {
        issues.push(issueKey);
      }
      if (openingMatch !== '[' || !/^\]\(http[^)]+\)$/i.test(closingMatch)) {
        return `${openingMatch}[${issueKey}](${baseUrl}/browse/${issueKey})${closingMatch}`;
      }
      return `[${issueKey}](${baseUrl}/browse/${issueKey})`;
    }
  );

  return {
    issues,
    newText
  };
}
