// @flow
import { gitlabJiraLinksHeaderRegexp } from './constants';

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
    let newMarkdownSubstring;
    let safeTextSubstring;
    if (
      !new RegExp(`${regexSafeBaseUrl}`, 'i').test(openingMatch) &&
      (openingMatch !== '[' || !/^\]\(http[^)]+\)$/i.test(closingMatch))
    ) {
      newMarkdownSubstring = `${openingMatch}[${issueKey}](${baseUrl}/browse/${issueKey})${closingMatch}`;
      safeTextSubstring = `${openingMatch}${issueKey}${closingMatch}`;
    } else {
      newMarkdownSubstring = `[${issueKey}](${baseUrl}/browse/${issueKey})${
        openingMatch === '[' ? '' : closingMatch
      }`;
      safeTextSubstring = `${issueKey}${openingMatch === '[' ? '' : closingMatch}`;
    }
    newMarkdown += newMarkdownSubstring;
    safeText += safeTextSubstring;

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

const splitRegexDetails = `<details>[^<]*?${gitlabJiraLinksHeaderRegexp}`;
const splitRegexBarriers = '<[^>]+>|\\\\`|```|`|\\\\[^`]|[^`\\\\<]+';

export function parseMarkdown(
  jiraProjectKeys: String[],
  baseUrl: string,
  inputText: string
): { text: string, markdown?: string, issues?: string[] }[] {
  const splitRegex = new RegExp(`${splitRegexDetails}|${splitRegexBarriers}`, 'gi');
  if (!/[`<]/gi.test(inputText)) {
    return [parseTextBlock(jiraProjectKeys, baseUrl, inputText)];
  }
  let match = splitRegex.exec(inputText);
  const result = [];
  let isDetails = false;
  let isCode = false;
  let isCodeBlock = false;
  let lastIndex = 0;
  while (match) {
    const substring = inputText.substring(lastIndex, match.index);
    if (substring) {
      result.push({ text: substring, markdown: substring });
    }
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
    } else if (isDetails) {
      if (match[0] === '</details>') {
        isDetails = false;
      }
    } else if (match[0].match(/^<details>/)) {
      // can do simple check for this as the rest of the check is in the regex
      isDetails = true;
    } else if (match[0].match(/^<[^>]+>$/)) {
      // non details tag match - don't parse
    } else if (match[0] !== '\\') {
      const parsedResult = parseTextBlock(jiraProjectKeys, baseUrl, match[0]);
      issues = parsedResult.issues;
      markdown = parsedResult.markdown || match[0];
      text = parsedResult.text;
    }
    if (text || markdown) {
      result.push({ text, isCode, isCodeBlock, markdown, issues });
    }
    lastIndex = match.index + match[0].length;
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
