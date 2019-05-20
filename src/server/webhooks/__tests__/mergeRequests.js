import processWebhookMergeRequest from '../mergeRequest';

let mockJiraRequest = jest.fn(() => Promise.reject());

jest.mock('../../apis/jira', () => ({
  jiraRequest: (jiraApi, method, url, body) => {
    return mockJiraRequest(method, url, body);
  }
}));

describe('processWebhookMergeRequest', () => {
  beforeEach(() => {
    mockJiraRequest = jest.fn((method, url, body) => {
      if (url === transitionUrl) {
        if (method === 'get') {
          return Promise.resolve({
            transitions: [
              { id: transitionId, to: { id: testTransitionStatusToId } }
            ]
          });
        }
      }
      return Promise.resolve({});
    });
  });

  const jiraProjectKey = 'TC';
  const issueKey = `${jiraProjectKey}-12`;
  const transitionUrl = `/issue/${issueKey}/transitions`;
  const testTransitionStatusToId = 'testTransitionId-01';
  const transitionId = 'transitionId';
  const transitionKeyword = 'Transition';
  let jiraProjectIds = [jiraProjectKey];
  const response = {
    action: 'open'
  };
  const gitlabApi = {
    MergeRequests: {
      show: () =>
        Promise.resolve({
          id: 'testid',
          description: 'description',
          title: 'title',
          state: 'opened',
          web_url: 'http://web_url'
        }),
      commits: () =>
        Promise.resolve([
          {
            title: 'commit title',
            message: `${transitionKeyword} ${issueKey}`
          }
        ]),
      edit: () => Promise.resolve({})
    }
  };

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
