import coreProcessWebhookMergeRequest from '../mergeRequest';

let mockJiraRequest = jest.fn(() => Promise.reject());
let mockSettingsRequest = jest.fn(() => Promise.resolve({}));

jest.mock('../../apis/jira', () => ({
  jiraRequest: (jiraApi, method, url, body) => {
    return mockJiraRequest(method, url, body);
  }
}));

jest.mock('../settings', () => ({
  getWebhookSettings: () => mockSettingsRequest()
}));

jest.mock('../sendDevInfo');

function processWebhookMergeRequest(
  jiraApi,
  jiraAddon,
  clientKey,
  gitlabApi,
  baseJiraUrl,
  jiraProjectIds,
  metadata,
  response
) {
  return coreProcessWebhookMergeRequest(
    jiraApi,
    jiraAddon,
    clientKey,
    gitlabApi,
    baseJiraUrl,
    jiraProjectIds,
    metadata,
    response,
    { object_attributes: {}, project: {} },
    123456
  );
}

describe('processWebhookMergeRequest', () => {
  let jiraProjectKey;
  let issueKey;
  let transitionUrl;
  let testTransitionStatusToId;
  let transitionId;
  let transitionKeyword;
  let jiraProjectIds;
  let response;
  let gitlabApi;

  beforeEach(() => {
    mockSettingsRequest = jest.fn(() => Promise.resolve({}));
    mockJiraRequest = jest.fn((method, url, body) => {
      if (url === transitionUrl && method === 'get') {
        return Promise.resolve({
          transitions: [
            { id: transitionId, to: { id: testTransitionStatusToId } }
          ]
        });
      } else if (
        url.match(
          /\/search\?jql=issuekey in \([^)]+\)&fields=issuetype,summary/gi
        )
      ) {
        const issueIds = /\/search\?jql=issuekey in \(([^)]+)\)&fields=issuetype,summary/gi.exec(
          url
        );
        if (issueIds && issueIds[1]) {
          return Promise.resolve({
            issues: issueIds[1].split(',').map((key) => ({
              key,
              fields: {
                summary: `Summary for ${key}`
              }
            }))
          });
        }
        return promise.resolve();
      }
      return Promise.resolve({});
    });
    jiraProjectKey = 'TC';
    issueKey = `${jiraProjectKey}-12`;
    transitionUrl = `/issue/${issueKey}/transitions`;
    testTransitionStatusToId = 'testTransitionId-01';
    transitionId = 'transitionId';
    transitionKeyword = 'Transition';
    jiraProjectIds = [jiraProjectKey];
    response = {
      action: 'open'
    };
    gitlabApi = {
      MergeRequests: {
        show: () =>
          Promise.resolve({
            id: 'testid',
            description: 'description',
            title: 'title',
            state: 'opened',
            web_url: 'http://web_url',
            author: {},
            references: {}
          }),
        commits: () =>
          Promise.resolve([
            {
              title: 'commit title',
              message: `${transitionKeyword} ${issueKey}`
            }
          ]),
        edit: () => Promise.resolve({}),
        approvalState: () => Promise.resolve({})
      },
      Users: {
        show: () => Promise.resolve({}),
        search: () => Promise.resolve(null),
        current: () => Promise.resolve({ id: 'self' })
      },
      Commits: {
        diff: () => Promise.resolve([]),
        show: () => Promise.resolve({ title: '', message: '' })
      }
    };
  });

  test('should replace existing description block if different', async () => {
    const metadata = {
      transitionKeywords: [transitionKeyword],
      transitionMap: [],
      defaultTransitionMap: []
    };
    const description = `Adding support for the “phone” type field with correct validation and formatting.\n\nCompletes [TC-13](http://jira.com/browse/TC-13)\n\n<details>\n  <summary>All Jira Seneschal Links</summary>\n  \n  | Ticket | Title |\n  | --- | --- |\n  | [${issueKey}](http://jira.com/browse/${issueKey}) | Summary for TC-13 |\n</details>\n\n`;
    gitlabApi.MergeRequests.show = () =>
      Promise.resolve({
        id: 'testid',
        description,
        title: 'title',
        state: 'opened',
        web_url: 'http://web_url',
        author: {},
        references: {}
      });
    gitlabApi.MergeRequests.edit = jest.fn(() => Promise.resolve({}));
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(gitlabApi.MergeRequests.edit).toHaveBeenCalledWith(
      undefined,
      undefined,
      {
        description: `Adding support for the “phone” type field with correct validation and formatting.\n\nCompletes [TC-13](http://jira.com/browse/TC-13)\n\n<details>\n  <summary>All Jira Seneschal Links</summary>\n  \n  | Ticket | Title |\n  | --- | --- |\n  | [TC-13](http://jira.com/browse/TC-13) | Summary for TC-13 |\n  | [${issueKey}](http://jira.com/browse/${issueKey}) | Summary for ${issueKey} |\n</details>\n\n`
      }
    );
  });

  test('should not update for no changes', async () => {
    const metadata = {
      transitionKeywords: [transitionKeyword],
      transitionMap: [],
      defaultTransitionMap: []
    };
    const description = `Adding support for the “phone” type field with correct validation and formatting.\n\nCompletes [${issueKey}](http://jira.com/browse/${issueKey})\n\n<details>\n  <summary>All Jira Seneschal Links</summary>\n  \n  | Ticket | Title |\n  | --- | --- |\n  | [${issueKey}](http://jira.com/browse/${issueKey}) | Summary for TC-12 |\n</details>\n\n`;
    gitlabApi.MergeRequests.show = () =>
      Promise.resolve({
        id: 'testid',
        description,
        title: 'title',
        state: 'opened',
        web_url: 'http://web_url',
        author: {},
        references: {}
      });
    gitlabApi.MergeRequests.edit = jest.fn(() => Promise.resolve({}));
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(gitlabApi.MergeRequests.edit).not.toHaveBeenCalled();
  });

  test('should correctly get map and trigger transition', async () => {
    const metadata = {
      transitionKeywords: [transitionKeyword],
      transitionMap: [
        {
          jiraProjectKey,
          openStatusIds: [testTransitionStatusToId]
        }
      ],
      defaultTransitionMap: []
    };
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(mockJiraRequest).toHaveBeenCalledWith('post', transitionUrl, {
      transition: { id: transitionId }
    });
  });

  test('should correctly get map and trigger transition from description with setting', async () => {
    mockSettingsRequest = jest.fn(() =>
      Promise.resolve({
        useDescriptionTransitions: true
      })
    );
    const description = `Adding support for the “phone” type field with correct validation and formatting.\n\nCompletes [${issueKey}](http://jira.com/browse/${issueKey})\n\n<details>\n  <summary>All Jira Seneschal Links</summary>\n  \n  | Ticket | Title |\n  | --- | --- |\n  | [${issueKey}](http://jira.com/browse/${issueKey}) | Summary for ${issueKey} |\n</details>\n\n`;
    gitlabApi.MergeRequests.show = () =>
      Promise.resolve({
        id: 'testid',
        description,
        title: 'title',
        state: 'opened',
        web_url: 'http://web_url',
        author: {},
        references: {}
      });
    gitlabApi.MergeRequests.commits = () =>
      Promise.resolve([
        {
          title: 'commit title',
          message: `Some other commit message`
        }
      ]);
    const metadata = {
      transitionKeywords: ['Completes'],
      transitionMap: [
        {
          jiraProjectKey,
          openStatusIds: [testTransitionStatusToId]
        }
      ],
      defaultTransitionMap: []
    };
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(mockJiraRequest).toHaveBeenCalledWith('post', transitionUrl, {
      transition: { id: transitionId }
    });
  });

  test('should correctly get default map and trigger transition', async () => {
    const metadata = {
      transitionKeywords: [transitionKeyword],
      transitionMap: [
        {
          jiraProjectKey: 'Other',
          openStatusIds: [testTransitionStatusToId]
        }
      ],
      defaultTransitionMap: [
        {
          openStatusIds: [testTransitionStatusToId]
        }
      ]
    };
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(mockJiraRequest).toHaveBeenCalledWith('post', transitionUrl, {
      transition: { id: transitionId }
    });
  });

  test('should correctly get default map and trigger with no custom transitions', async () => {
    const metadata = {
      transitionKeywords: [transitionKeyword],
      transitionMap: [],
      defaultTransitionMap: [
        {
          openStatusIds: [testTransitionStatusToId]
        }
      ]
    };
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(mockJiraRequest).toHaveBeenCalledWith('post', transitionUrl, {
      transition: { id: transitionId }
    });
  });

  test('should not call default map and if project transitions defined but not matched', async () => {
    mockJiraRequest = jest.fn((method, url, body) => {
      if (url === transitionUrl) {
        if (method === 'get') {
          return Promise.resolve({
            transitions: []
          });
        }
      }
      return Promise.resolve({});
    });
    const metadata = {
      transitionKeywords: [transitionKeyword],
      transitionMap: [
        {
          jiraProjectKey,
          openStatusIds: ['test-no-match']
        }
      ],
      defaultTransitionMap: [
        {
          openStatusIds: [testTransitionStatusToId]
        }
      ]
    };
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(mockJiraRequest).not.toHaveBeenCalledWith('post', transitionUrl, {
      transition: { id: transitionId }
    });
  });

  test('should correctly handle existing but empty default transition map', async () => {
    const metadata = {
      transitionKeywords: [transitionKeyword],
      transitionMap: [
        {
          jiraProjectKey: 'Other',
          openStatusIds: [testTransitionStatusToId]
        }
      ],
      defaultTransitionMap: [
        {
          openStatusIds: []
        }
      ]
    };
    await processWebhookMergeRequest(
      {},
      {},
      'client-key',
      gitlabApi,
      'http://jira.com',
      jiraProjectIds,
      metadata,
      response
    );
    expect(mockJiraRequest).not.toHaveBeenCalledWith('post', transitionUrl, {
      transition: { id: transitionId }
    });
  });
});
