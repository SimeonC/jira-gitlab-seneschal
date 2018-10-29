import cases from 'jest-in-case';
import linkIssues from '../linkIssues';

const projectKeys = ['TC', 'NAS'];
const baseUrl = 'http://jira.com';
const issueKeys = ['TC-12', 'TC-123', 'NAS-45'];

function writeLink(issue) {
  return `[${issue}](${baseUrl}/browse/${issue})`;
}

cases(
  'processCommits',
  ({ projectKeys, baseUrl, text, foundIssues, resultText }) => {
    const { issues, newText } = linkIssues(projectKeys, baseUrl, text);
    expect(issues).toEqual(foundIssues);
    expect(newText).toEqual(resultText);
  },
  [
    {
      name: 'single find and replace',
      projectKeys,
      baseUrl,
      text: `This tests if ${issueKeys[0]} is correctly matched`,
      foundIssues: [issueKeys[0]],
      resultText: `This tests if ${writeLink(
        issueKeys[0]
      )} is correctly matched`
    },
    {
      name: 'url find and replace',
      projectKeys,
      baseUrl,
      text: `This tests if ${baseUrl}/browse/${
        issueKeys[0]
      } is correctly matched`,
      foundIssues: [issueKeys[0]],
      resultText: `This tests if ${writeLink(
        issueKeys[0]
      )} is correctly matched`
    },
    {
      name: 'single find and replace at start',
      projectKeys,
      baseUrl,
      text: `${issueKeys[0]} is correctly matched`,
      foundIssues: [issueKeys[0]],
      resultText: `${writeLink(issueKeys[0])} is correctly matched`
    },
    {
      name: 'url find and replace at start',
      projectKeys,
      baseUrl,
      text: `${baseUrl}/browse/${issueKeys[0]} is correctly matched`,
      foundIssues: [issueKeys[0]],
      resultText: `${writeLink(issueKeys[0])} is correctly matched`
    },
    {
      name: 'single find and replace at end',
      projectKeys,
      baseUrl,
      text: `This tests if ${issueKeys[0]}`,
      foundIssues: [issueKeys[0]],
      resultText: `This tests if ${writeLink(issueKeys[0])}`
    },
    {
      name: 'url find and replace at end',
      projectKeys,
      baseUrl,
      text: `This tests if ${baseUrl}/browse/${issueKeys[0]}`,
      foundIssues: [issueKeys[0]],
      resultText: `This tests if ${writeLink(issueKeys[0])}`
    },
    {
      name: 'no replace should return null result text',
      projectKeys,
      baseUrl,
      text: 'This tests if no matches works is correctly matched',
      foundIssues: [],
      resultText: null
    },
    {
      name: 'returns already linked issues and null for unchanged text',
      projectKeys,
      baseUrl,
      text: `This tests if ${writeLink(issueKeys[0])} is correctly matched`,
      foundIssues: [issueKeys[0]],
      resultText: null
    },
    {
      name: 'handles mixed links and non-links',
      projectKeys,
      baseUrl,
      text: `This tests if ${writeLink(
        issueKeys[0]
      )} is correctly matched and ${issueKeys[1]}`,
      foundIssues: [issueKeys[0], issueKeys[1]],
      resultText: `This tests if ${writeLink(
        issueKeys[0]
      )} is correctly matched and ${writeLink(issueKeys[1])}`
    },
    {
      name: 'handles many links and non-links',
      projectKeys,
      baseUrl,
      text: `This tests if ${writeLink(
        issueKeys[0]
      )} is correctly matched and ${
        issueKeys[1]
      } and lastly ${baseUrl}/browse/${issueKeys[2]} is parsed`,
      foundIssues: [issueKeys[0], issueKeys[1], issueKeys[2]],
      resultText: `This tests if ${writeLink(
        issueKeys[0]
      )} is correctly matched and ${writeLink(
        issueKeys[1]
      )} and lastly ${writeLink(issueKeys[2])} is parsed`
    }
  ]
);
