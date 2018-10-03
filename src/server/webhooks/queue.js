//@flow
import uuid from 'uuid/v4';
import lowdb from '../lowdb';
import gitlabApi from '../apis/gitlab';
import {
  getWebhookClientKey,
  getWebhookMetadata,
  updateProject,
  WEBHOOK_TYPES
} from '../apis/webhooks';
import processWebhookComment from './comments';
import { jiraRequest } from '../apis/jira';
import processWebhookMergeRequest from './mergeRequest';

export type WebhookProcessResponseType = {
  projectId: string,
  projectNamespace: string,
  mergeRequestId: string,
  action: string,
  issues: string[]
};

type QueueElement = {
  key: string,
  secretKey: string,
  body: *
};

type FailureElement = {
  id: string,
  original: QueueElement,
  error: any
};

let queueIsProcessing = false;

function getQueueDb(encryptionKey: string) {
  return lowdb(
    'webhookQueue',
    {
      queue: [],
      failures: []
    },
    encryptionKey
  );
}

export function enqueueWebhook(
  encryptionKey: string,
  jiraAddon: *,
  element: QueueElement
) {
  getQueueDb(encryptionKey)
    .get('queue')
    .push(element)
    .write();
  if (!queueIsProcessing) {
    processQueue(encryptionKey, jiraAddon);
  }
}

async function processElement(
  encryptionKey: string,
  jiraAddon: *,
  gitlabApiInstance: *,
  queueElement: QueueElement
) {
  const clientKey = getWebhookClientKey(
    encryptionKey,
    queueElement.key,
    queueElement.secretKey
  );
  // It's OK if this errors - it just means it'll get retried later.
  const metadata = getWebhookMetadata(encryptionKey, clientKey);
  const { baseUrl } = await jiraAddon.settings.get('clientInfo', clientKey);
  const jiraApi = jiraAddon.httpClient({ clientKey });

  const jiraProjects = await jiraRequest(jiraApi, 'get', '/project');
  const jiraProjectKeys = jiraProjects.map(({ key }) => key);

  let processMetadata: ?WebhookProcessResponseType;
  switch (queueElement.body.object_kind) {
    case WEBHOOK_TYPES.COMMENTS:
      processMetadata = await processWebhookComment(
        jiraApi,
        gitlabApiInstance,
        baseUrl,
        jiraProjectKeys,
        queueElement.body
      );
      break;
    case WEBHOOK_TYPES.MERGE_REQUESTS:
      processMetadata = {
        projectId: queueElement.body.project.id,
        projectNamespace: queueElement.body.project.path_with_namespace,
        mergeRequestId: queueElement.body.object_attributes.iid,
        issues: [],
        action: queueElement.body.object_attributes.action
      };
      await processWebhookMergeRequest(
        jiraApi,
        gitlabApiInstance,
        baseUrl,
        jiraProjectKeys,
        metadata,
        processMetadata,
        queueElement.body.changes
      );
      break;
  }
  if (processMetadata) {
    updateProject(encryptionKey, processMetadata.projectId, {
      status: 'healthy'
    });
  }
}

export async function processQueue(encryptionKey: string, jiraAddon: *) {
  const queueDb = getQueueDb(encryptionKey);
  const queue = queueDb.get('queue').value();
  if (queue.length === 0) {
    queueIsProcessing = false;
    return false;
  }
  queueIsProcessing = true;
  const queueElement: QueueElement = queue.shift();
  queueDb.set('queue', queue).write();

  const gitlabApiInstance = gitlabApi(encryptionKey);

  try {
    await processElement(
      encryptionKey,
      jiraAddon,
      gitlabApiInstance,
      queueElement
    );
  } catch (error) {
    console.error(error);
    try {
      queueDb
        .get('failures')
        .push({
          id: uuid(),
          original: queueElement,
          error: { message: error.toString(), details: JSON.stringify(error) }
        })
        .write();
      const { web_url, name_with_namespace } = gitlabApiInstance.Projects.show(
        queueElement.body.project.id
      );
      updateProject(encryptionKey, queueElement.body.project.id, {
        name: name_with_namespace,
        url: web_url,
        status: 'sick'
      });
    } catch (fatalError) {
      console.error(fatalError);
    }
  } finally {
    return processQueue(encryptionKey, jiraAddon);
  }
}
