// @flow
import GitlabApi from 'gitlab';
import repeat from 'lodash/repeat';

function transformByRegex(
  markdownString: string,
  regex: RegExp,
  transformFunction: (match: string[]) => string
) {
  let transformedMarkdown = '';
  let currentMatch;
  let previousIndex = 0;
  while ((currentMatch = regex.exec(markdownString))) {
    transformedMarkdown += markdownString.substring(
      previousIndex,
      currentMatch.index
    );
    transformedMarkdown += transformFunction(currentMatch);
    previousIndex = currentMatch.index + currentMatch[0].length;
  }

  return transformedMarkdown + markdownString.substring(previousIndex);
}

function transformImages(markdownString: string, webUrl: string) {
  return transformByRegex(
    markdownString,
    /(!\[[^\]]+])\(([^)]+)\)/gim,
    (currentMatch) => {
      if (/^http(s|):\/\//gi.test(currentMatch[2]))
        return `!${currentMatch[2]}|width="100%"!`;
      return `!${webUrl}${currentMatch[2]}|width="100%"!`;
    }
  );
}

function transformLinks(markdownString: string, webUrl: string) {
  return transformByRegex(
    markdownString,
    /\[([^\]]+)]\(([^)]+)\)/gim,
    (currentMatch) => `[${currentMatch[1]}|${currentMatch[2]}]`
  );
}

function transformLists(markdownString: string, webUrl: string) {
  return transformByRegex(
    markdownString,
    /\n([ ]*)([*\-+]|[0-9]+.)/gim,
    (currentMatch) => {
      const level = currentMatch[1].length / 2;
      const listType = /[*\-+]/i.test(currentMatch[2]) ? '*' : '#';
      return `\n${repeat(listType, level + 1)}`;
    }
  );
}

function transformFormatting(markdownString: string, webUrl: string) {
  const strikethrough = transformByRegex(markdownString, /~~/gim, () => '-');
  const emphasis = transformByRegex(
    strikethrough,
    /(^|[^*\n])\*([^*\n]+)\*([^*]|$)/gim,
    (currentMatch) => `${currentMatch[1]}_${currentMatch[2]}_${currentMatch[3]}`
  );
  const firstBoldFix = transformByRegex(
    emphasis,
    /(^|[^*])\*\*([^*]|$)/gim,
    (currentMatch) => `${currentMatch[1]}*${currentMatch[2]}`
  );
  return transformByRegex(
    firstBoldFix,
    // this intentionally ignores a single case of __*two*__ which will loose emphasis
    /(^|[^_])_{2,3}([^_]|$)/gim,
    (currentMatch) => `${currentMatch[1]}*${currentMatch[2]}`
  );
}

function transformHeaders(markdownString: string, webUrl: string) {
  return transformByRegex(
    markdownString,
    /(^|\n)+[\W]*([#]+)\W*/gim,
    (currentMatch) => {
      const headerSize = currentMatch[0].replace(/[^#]+/g, '').length;
      return `${currentMatch[1]}h${headerSize}. `;
    }
  );
}

function transformInlineCode(markdownString: string, webUrl: string) {
  return transformByRegex(
    markdownString,
    /(^|[^`])`([^`]+)`([^`]|$)/gi,
    (currentMatch) =>
      `${currentMatch[1]}{{${currentMatch[2]}}}${currentMatch[3]}`
  );
}

function transformMultilineCode(markdownString: string, webUrl: string) {
  return transformByRegex(
    markdownString,
    /```([\S\s]+?)```/gim,
    (currentMatch) => `{code}${currentMatch[1]}{code}`
  );
}

export default async function markdownTransform(
  gitlabApi: GitlabApi,
  projectId: string,
  markdownString: string
) {
  try {
    const { web_url } = await gitlabApi.Projects.show(projectId);

    return [
      transformHeaders,
      transformImages,
      transformLinks,
      transformFormatting,
      transformLists,
      transformInlineCode,
      transformMultilineCode
    ].reduce((markdown, func) => func(markdown, web_url), markdownString);
  } catch (error) {
    return markdownString;
  }
}
