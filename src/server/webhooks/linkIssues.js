function parseTextBlock(
  jiraProjectKeys: string[],
  baseUrl: string,
  text: string
): { issues: string[], markdown: ?string, text: string } {
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
  let currentMatch = matchRegex.exec(text);
  let newMarkdown = '';
  let safeText = '';
  let lastIndex = 0;
  if (!currentMatch) {
    return {
      issues: [],
      markdown: null,
      text
    };
  }

  while (currentMatch) {
    const [
      match,
      openingMatch,
      projectKey,
      issueId,
      closingMatch
    ] = currentMatch;
    const startIndex = currentMatch.index;
    newMarkdown += text.substring(lastIndex, startIndex);
    safeText += text.substring(lastIndex, startIndex);
    lastIndex = startIndex + match.length;
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
      newMarkdown += `${openingMatch}[${issueKey}](${baseUrl}/browse/${issueKey})${closingMatch}`;
      safeText += `${openingMatch}${issueKey}${closingMatch}`;
    } else {
      newMarkdown += `[${issueKey}](${baseUrl}/browse/${issueKey})${
        openingMatch === '[' ? '' : closingMatch
      }`;
      safeText += `${issueKey}${openingMatch === '[' ? '' : closingMatch}`;
    }

    currentMatch = matchRegex.exec(text);
  }

  if (lastIndex && lastIndex < text.length) {
    newMarkdown += text.substring(lastIndex);
    safeText += text.substring(lastIndex);
  }

  safeText = safeText.replace(/\[([^]+)\]\([^\)]\)/gi, '$1');

  return {
    issues,
    markdown: transformedIssues.length ? newMarkdown : null,
    text: safeText
  };
}

export function parseMarkdown(
  jiraProjectKeys: String[],
  baseUrl: string,
  inputText: string
): { text: string, markdown?: string, issues?: string[] }[] {
  const splitRegex = /\\`|```|`|\\[^`]|[^`\\]+/gi;
  if (!/`/gi.test(inputText)) {
    return [parseTextBlock(jiraProjectKeys, baseUrl, inputText)];
  }
  let match = splitRegex.exec(inputText);
  const result = [];
  let isCode = false;
  let isCodeBlock = false;
  let lastIndex = 0;
  while (match) {
    const substring = inputText.substring(lastIndex, match.index);
    result.push({ text: substring, markdown: substring });
    let text = match[0];
    let markdown;
    let issues;
    if (isCode) {
      if (
        (isCodeBlock && match[0] === '```') ||
        (!isCodeBlock && match[0] === '`')
      ) {
        isCode = false;
      }
    } else if (match[0] === '```' || match[0] === '`') {
      isCode = true;
      isCodeBlock = match[0] === '```';
    } else if (match[0] !== '\\') {
      const parsedResult = parseTextBlock(jiraProjectKeys, baseUrl, match[0]);
      issues = parsedResult.issues;
      markdown = parsedResult.markdown || match[0];
      text = parsedResult.text;
    }
    result.push({ text, isCode, isCodeBlock, markdown, issues });
    lastIndex = match.index + text.length;
    match = splitRegex.exec(inputText);
  }
  const substring = inputText.substring(lastIndex);
  result.push({ text: substring, markdown: substring });
  return result;
}

export default function linkIssues(
  jiraProjectKeys: string[],
  baseUrl: string,
  inputText: string
): { issues: string[], newText: ?string } {
  const parsedText = parseMarkdown(jiraProjectKeys, baseUrl, inputText);
  return parsedText.reduce(
    (result, { text, markdown, issues }, index) => {
      if (issues && issues.length) {
        result.issues = result.issues.concat(issues);
      }
      if (markdown) {
        result.newText = `${
          result.newText ? result.newText : result.text
        }${markdown}`;
      } else if (result.newText) {
        result.newText += text;
      }
      result.text += text;
      return result;
    },
    {
      issues: [],
      newText: null,
      text: ''
    }
  );
}
