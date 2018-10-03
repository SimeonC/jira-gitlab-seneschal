//@flow
import lowdb from '../lowdb';
import createJiraIssue from './createJiraIssue';
import transitionProjectApi from '../apis/transitionProject';
import { getCredential, setCredential } from '../apis/credentials';

type QueueElement = {
  // gitlab project id
  projectId: string,
  issueIid: string
};

type ProcessingProject = {
  isProcessing: boolean,
  completedCount: number,
  totalCount: number,
  gitlabProjectName: string,
  currentMessage: string,
  currentIssueIid: string
};

function loadQueueDb(encryptionKey: string) {
  return lowdb(
    'migrationQueue',
    {
      queue: [],
      failures: [],
      processingProjects: {}
    },
    encryptionKey
  );
}

const JIRA_GITLAB_PROJECT_KEY = 'jira-client-key-for-gitlab-project';

let queueIsProcessing = false;

export function reprocessFailure(
  encryptionKey: string,
  jiraAddon: *,
  issueIid: string,
  projectId: string
) {
  const queueDb = loadQueueDb(encryptionKey);
  const failures = queueDb.get('failures').value();
  const reprocessedFailure = failures.find(
    ({ queueElement }) =>
      queueElement.issueIid === issueIid && queueElement.projectId === projectId
  );
  if (!reprocessedFailure) return;
  failures.remove(reprocessedFailure);
  queueDb.set('failures', failures).write();
  queueDb
    .get('queue')
    .push(reprocessedFailure.queueElement)
    .write();
  if (!queueIsProcessing) processQueue(encryptionKey, jiraAddon);
}

export function reprocessAllFailures(encryptionKey: string, jiraAddon: *) {
  const queueDb = loadQueueDb(encryptionKey);
  const failures = queueDb.get('failures').value();
  queueDb.set('failures', []).write();
  queueDb
    .get('queue')
    .push(...failures.map(({ queueElement }) => queueElement))
    .write();
  if (!queueIsProcessing) processQueue(encryptionKey, jiraAddon);
}

export function projectStatuses(
  encryptionKey: string
): (ProcessingProject & {
  projectId: string
})[] {
  const queueDb = loadQueueDb(encryptionKey);
  const projects = queueDb.get('processingProjects').value();
  return Object.keys(projects).map((projectId) => ({
    ...projects[projectId],
    projectId
  }));
}

export function projectStatus(
  encryptionKey: string,
  gitlabProjectId: string
): (ProcessingProject & {
  projectId: string
})[] {
  const queueDb = loadQueueDb(encryptionKey);
  const projects = queueDb.get('processingProjects').value();
  return {
    ...projects[gitlabProjectId],
    projectId: gitlabProjectId
  };
}

export async function startProcessingProject(
  encryptionKey: string,
  jiraAddon: *,
  clientKey: string,
  projectId: string
) {
  const queueDb = loadQueueDb(encryptionKey);
  const projectDb = transitionProjectApi(encryptionKey, projectId);
  projectDb.set('isProcessing', true).write();
  setCredential(encryptionKey, `${JIRA_GITLAB_PROJECT_KEY}-${projectId}`, {
    clientKey
  });
  const issues = projectDb.get('issues').value();
  issues.forEach((issue) => {
    queueDb
      .get('queue')
      .push({
        projectId,
        issueIid: issue.iid
      })
      .write();
  });
  queueDb
    .set(`processingProjects.${projectId}`, {
      projectId,
      isLoading: false,
      isProcessing: true,
      completedCount: 0,
      totalCount: issues.length,
      gitlabProjectName: projectDb.get('meta').value().nameWithNamespace,
      currentMessage: 'Starting Up'
    })
    .write();
  if (!queueIsProcessing) {
    return processQueue(encryptionKey, jiraAddon);
  }
}

function initJiraApi(encryptionKey: string, addon: *, gitlabProjectId: string) {
  const jiraCredentials = getCredential(
    encryptionKey,
    `${JIRA_GITLAB_PROJECT_KEY}-${gitlabProjectId}`
  );
  return addon.httpClient(jiraCredentials);
}

export async function processQueue(encryptionKey: string, jiraAddon: *) {
  const queueDb = loadQueueDb(encryptionKey);
  const queue = queueDb.get('queue').value();
  if (queue.length === 0) {
    queueIsProcessing = false;
    return false;
  }
  queueIsProcessing = true;
  const queueElement: QueueElement = queue.shift();
  queueDb.set('queue', queue).write();

  const jiraApi = initJiraApi(encryptionKey, jiraAddon, queueElement.projectId);

  queueDb
    .set(
      `processingProjects.${queueElement.projectId}.currentIssueIid`,
      queueElement.issueIid
    )
    .write();
  try {
    await createJiraIssue(
      encryptionKey,
      jiraApi,
      queueElement.projectId,
      queueElement.issueIid,
      (message) => {
        queueDb
          .set(
            `processingProjects.${queueElement.projectId}.currentMessage`,
            message
          )
          .write();
      }
    );

    const processingProject = queueDb.get('processingProjects').value()[
      queueElement.projectId
    ];
    queueDb
      .set(
        `processingProjects.${queueElement.projectId}.completedCount`,
        processingProject.completedCount + 1
      )
      .write();
  } catch (error) {
    queueDb
      .get('failures')
      .push({
        queueElement,
        error: error.response ? error.response.data : error.toString(),
        config: error.config
          ? {
              url: error.config.url,
              data: JSON.parse(error.config.data)
            }
          : null
      })
      .write();
  }

  return processQueue(encryptionKey, jiraAddon);
}
