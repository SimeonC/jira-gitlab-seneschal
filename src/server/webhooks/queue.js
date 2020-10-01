//@flow
import gitlabApi from '../apis/gitlab';
import {
  getWebhookClientKey,
  getWebhookMetadata,
  updateProject
} from '../apis/webhooks';
import { WEBHOOK_TYPES } from '../apis/webhooks.types';
import processWebhookComment from './comments';
import { jiraRequest } from '../apis/jira';
import processWebhookMergeRequest from './mergeRequest';
import { processPush } from './push';

export type WebhookProcessResponseType = {
  projectId: string,
  projectNamespace: string,
  mergeRequestId: string,
  action: string,
  issues: string[]
};

type QueueElement = {
  id: number,
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

export async function enqueueWebhook(jiraAddon: *, element: QueueElement) {
  await jiraAddon.schema.models.WebhookQueue.create(element);
  if (!queueIsProcessing) {
    processQueue(jiraAddon);
  }
}

async function processElement(
  jiraAddon: *,
  gitlabApiInstance: *,
  queueElement: QueueElement,
  clientKey: string
) {
  // It's OK if this errors - it just means it'll get retried later.
  const webhookMetadata = await getWebhookMetadata(
    jiraAddon.schema.models,
    clientKey
  );
  const { baseUrl } = await jiraAddon.settings.get('clientInfo', clientKey);
  const jiraApi = jiraAddon.httpClient({ clientKey });

  const jiraProjects = await jiraRequest(
    jiraApi,
    'get',
    '/project?expand=projectKeys'
  );
  const jiraProjectKeys = jiraProjects.reduce(
    (keys, { projectKeys }) => keys.concat(projectKeys),
    []
  );

  let processMetadata: ?WebhookProcessResponseType;
  switch (queueElement.body.object_kind) {
    case WEBHOOK_TYPES.COMMENTS:
      processMetadata = await processWebhookComment(
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
        jiraAddon,
        clientKey,
        gitlabApiInstance,
        baseUrl,
        jiraProjectKeys,
        webhookMetadata,
        processMetadata,
        queueElement.body,
        queueElement.id
      );
      break;
    case WEBHOOK_TYPES.PUSH:
      await processPush(
        jiraAddon,
        clientKey,
        gitlabApiInstance,
        baseUrl,
        jiraProjectKeys,
        webhookMetadata,
        queueElement.body,
        queueElement.id
      );
      break;
  }
  if (processMetadata) {
    const {
      web_url,
      name_with_namespace
    } = await gitlabApiInstance.Projects.show(queueElement.body.project.id);
    await updateProject(jiraAddon.schema.models, processMetadata.projectId, {
      name: name_with_namespace,
      url: web_url,
      status: 'healthy'
    });
  }
}

export async function processQueue(jiraAddon: *) {
  queueIsProcessing = true;
  const database = jiraAddon.schema.models;
  let nextQueueItem = await database.WebhookQueue.findOne();
  if (!nextQueueItem) {
    queueIsProcessing = false;
    return;
  }

  while (nextQueueItem) {
    await database.WebhookQueue.destroy({
      where: {
        id: nextQueueItem.id
      }
    });
    const clientKey = await getWebhookClientKey(
      jiraAddon.schema.models,
      nextQueueItem.key,
      nextQueueItem.secretKey
    );
    const gitlabApiInstance = await gitlabApi(jiraAddon, clientKey);
    try {
      await processElement(
        jiraAddon,
        gitlabApiInstance,
        nextQueueItem,
        clientKey
      );
    } catch (error) {
      console.error(error);
      let data;
      if (error.response) {
        try {
          data = JSON.stringify(error.response.data);
        } catch (error) {}
      }
      try {
        await database.WebhookFailures.create({
          original: nextQueueItem,
          error: {
            message: error.toString(),
            details: JSON.stringify(error),
            data
          }
        });
        const {
          web_url,
          name_with_namespace
        } = await gitlabApiInstance.Projects.show(
          nextQueueItem.body.project.id
        );
        await updateProject(database, nextQueueItem.body.project.id, {
          name: name_with_namespace,
          url: web_url,
          status: 'sick'
        });
      } catch (fatalError) {
        console.error(fatalError);
      }
    }

    nextQueueItem = await database.WebhookQueue.findOne();
  }

  queueIsProcessing = false;
}
