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

const queueDb = lowdb('webhookQueue', {
  queue: [],
  failures: []
});

let queueIsProcessing = false;

export function enqueueWebhook(
  jiraAddon: *,
  credentialsPassword: string,
  element: QueueElement
) {
  queueDb
    .get('queue')
    .push(element)
    .write();
  if (!queueIsProcessing) {
    processQueue(jiraAddon, credentialsPassword);
  }
}

export async function processQueue(jiraAddon: *, credentialPassword: string) {
  const queue = queueDb.get('queue').value();
  if (queue.length === 0) {
    queueIsProcessing = false;
    return false;
  }
  queueIsProcessing = true;
  const queueElement: QueueElement = queue.shift();
  queueDb.set('queue', queue).write();

  const gitlabApiInstance = gitlabApi(credentialPassword);

  try {
    const clientKey = getWebhookClientKey(
      credentialPassword,
      queueElement.key,
      queueElement.secretKey
    );
    // It's OK if this errors - it just means it'll get retried later.
    const metadata = getWebhookMetadata(clientKey);
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
      updateProject(processMetadata.projectId, {
        status: 'healthy'
      });
    }
    return processQueue(jiraAddon, credentialPassword);
  } catch (error) {
    console.error(error);
    try {
      queueDb
        .get('failures')
        .push({ id: uuid(), original: queueElement, error })
        .write();
      const { web_url, name_with_namespace } = gitlabApiInstance.Projects.show(
        queueElement.body.project.id
      );
      updateProject(queueElement.body.project.id, {
        name: name_with_namespace,
        url: web_url,
        status: 'sick'
      });
    } catch (fatalError) {
      console.error(fatalError);
    }
    return processQueue(jiraAddon, credentialPassword);
  }
}
