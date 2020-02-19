function parseTextBlock(
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
    )})\\-([1-9][0-9]*)($|]\\([^)]+\\)|)`,
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

export default function linkIssues(
  jiraProjectKeys: string[],
  baseUrl: string,
  text: string
): { issues: string[], newText: ?string } {
  const splitRegex = /\\`|```|`|\\[^`]|[^`\\]+/gi;
  if (!/`/gi.test(text)) {
    return parseTextBlock(jiraProjectKeys, baseUrl, text);
  }
  let match = splitRegex.exec(text);
  const result = {
    newText: '',
    issues: []
  };
  let isCode = false;
  let isCodeBlock = false;
  while (match) {
    if (isCode) {
      if (
        (isCodeBlock && match[0] === '```') ||
        (!isCodeBlock && match[0] === '`')
      ) {
        isCode = false;
      }
      result.newText += match[0];
    } else if (match[0] === '```' || match[0] === '`') {
      isCode = true;
      isCodeBlock = match[0] === '```';
      result.newText += match[0];
    } else if (match[0] === '\\') {
      result.newText += match[0];
    } else {
      const blockResult = parseTextBlock(jiraProjectKeys, baseUrl, match[0]);
      result.issues = result.issues.concat(blockResult.issues);
      result.newText =
        (result.newText || '') + (blockResult.newText || match[0]);
    }
    match = splitRegex.exec(text);
  }
  return result;
}
