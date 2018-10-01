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

function transformLists(markdownString: string) {
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

function transformFormatting(markdownString: string) {
  const strikethrough = transformByRegex(markdownString, /~~/gim, () => '-');
  const emphasis = transformByRegex(
    strikethrough,
    /([^*\n])\*([^*\n]+)\*([^*])/gim,
    (currentMatch) => `${currentMatch[1]}_${currentMatch[2]}_${currentMatch[3]}`
  );
  const firstBoldFix = transformByRegex(
    emphasis,
    /([^*])\*\*([^*])/gim,
    (currentMatch) => `${currentMatch[1]}*${currentMatch[2]}`
  );
  return transformByRegex(
    firstBoldFix,
    /([^_])__([^_])/gim,
    (currentMatch) => `${currentMatch[1]}*${currentMatch[2]}`
  );
}

function transformHeaders(markdownString: string) {
  return transformByRegex(markdownString, /\n([#]+)/gim, (currentMatch) => {
    const headerSize = currentMatch[1].length;
    return `\nh${headerSize}. `;
  });
}

export default async function markdownTransform(
  gitlabApi: GitlabApi,
  projectId: string,
  markdownString: string
) {
  try {
    const { web_url } = await gitlabApi.Projects.show(projectId);

    const imageFixedMarkdown = transformImages(markdownString, web_url);
    const headerFixedMarkdown = transformHeaders(imageFixedMarkdown);
    const formatFixedMarkdown = transformFormatting(headerFixedMarkdown);
    return transformLists(formatFixedMarkdown);
  } catch (error) {
    return markdownString;
  }
}
