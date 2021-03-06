// @flow
import type { DatabaseType } from '../models';
import { enqueueWebhook } from '../webhooks/queue';
import type {
  WebhookType,
  WebhookCredentialType,
  WebhookProjectStatusType,
  WebhookProjectStatusEnumType,
  WebhookMetadataType
} from './webhooks.types';
import { WEBHOOK_TYPE_KEYS } from './webhooks.types';
import { version } from '../../../package.json';

export function isValidWebhookType(type: WebhookType | string): boolean {
  return WEBHOOK_TYPE_KEYS.indexOf(type) !== -1;
}

const defaultKeywords = [
  'fix',
  'fixes',
  'fixed',
  'close',
  'closes',
  'closed',
  'complete',
  'completes',
  'completed',
  'resolve',
  'resolves',
  'resolved'
];

export async function getWebhookMetadata(
  database: DatabaseType,
  clientKey: string,
  force: boolean = false
): WebhookMetadataType {
  let transitionMetadata = await database.WebhookTransitions.findOne({
    where: {
      clientKey
    },
    include: [
      {
        model: database.WebhookTransitionMaps,
        as: 'transitionMap'
      },
      {
        model: database.WebhookDefaultTransitionMaps,
        as: 'defaultTransitionMap'
      }
    ],
    attributes: {
      exclude: ['clientKey']
    }
  });
  if (!transitionMetadata) {
    if (!force) {
      throw new Error('No Webhooks have been setup for this clientKey');
    }
    await database.WebhookTransitions.upsert({
      clientKey,
      transitionKeywords: defaultKeywords
    });
    transitionMetadata = {
      transitionKeywords: defaultKeywords,
      transitionMap: []
    };
  }
  // $FlowFixMe
  return transitionMetadata;
}

export function parseProjectProps({ url, ...props }) {
  let parsedUrl = url;
  if (url && !url.match(/\/hooks$/gi)) {
    parsedUrl = `${url.replace(/\/$/gi, '')}/hooks`;
  }
  return {
    ...props,
    url: parsedUrl
  };
}

export async function registerProject(
  database: DatabaseType,
  projectId: string,
  projectName: string,
  projectUrl: string,
  status?: string = 'pending'
): Promise<boolean> {
  return await upsertProject(database, projectId, {
    name: projectName,
    url: projectUrl,
    status,
    version
  });
}

export async function upsertProject(
  database: DatabaseType,
  projectId: string,
  props: { name: string, url: string, status: WebhookProjectStatusEnumType }
): boolean {
  await database.WebhookStatuses.upsert(
    parseProjectProps({
      ...props,
      id: `${projectId}`
    })
  );
  // $FlowFixMe
  return true;
}

export async function updateProject(
  database: DatabaseType,
  projectId: string,
  props: { name: string, url: string, status: WebhookProjectStatusEnumType }
): boolean {
  await database.WebhookStatuses.update(parseProjectProps(props), {
    where: {
      id: `${projectId}`
    }
  });
  // $FlowFixMe
  return true;
}

export async function allProjects(
  database: DatabaseType
): Promise<WebhookProjectStatusType[]> {
  try {
    return await database.WebhookStatuses.findAll();
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function getWebhookClientKey(
  database: DatabaseType,
  key: string,
  secretKey: string
) {
  const credential: WebhookCredentialType = await database.WebhookClients.findOne(
    {
      where: {
        key,
        secretKey
      }
    }
  );
  if (credential) {
    return credential.clientKey;
  }
  throw new Error(`Invalid secret key for webhook "${key}"`);
}

export async function isValidSecretKey(
  database: DatabaseType,
  key: string,
  secretKey: string
) {
  const count = await database.WebhookClients.count({
    where: {
      key,
      secretKey
    }
  });
  return count === 1;
}

export async function setWebhookClientKey(
  database: DatabaseType,
  key: string,
  secretKey: string,
  clientKey: string
) {
  await database.WebhookClients.upsert({
    key,
    secretKey,
    clientKey
  });
}

export async function getWebhookErrors(
  database: DatabaseType,
  pageSize: number = 20,
  pageOffset: number = 0
) {
  return await database.WebhookFailures.findAndCountAll({
    limit: pageSize,
    offset: pageOffset * pageSize,
    order: [['createdAt', 'DESC']]
  });
}

export async function retryWebhookFailure(
  jiraAddon: *,
  id: string
): Promise<boolean> {
  const failure = await jiraAddon.schema.models.WebhookFailures.findOne({
    where: {
      id
    }
  });
  if (!failure) return false;
  const credential: WebhookCredentialType = await jiraAddon.schema.models.WebhookClients.findOne(
    {
      where: {
        key: failure.original.key
      }
    }
  );
  // Force update the secret key to catch if the original secret key was wrong
  failure.original.secretKey = credential.secretKey;
  await enqueueWebhook(jiraAddon, failure.original);
  return (
    1 ===
    (await jiraAddon.schema.models.WebhookFailures.destroy({
      where: {
        id
      }
    }))
  );
}

export async function deleteWebhookFailure(
  database: DatabaseType,
  id: string
): Promise<boolean> {
  return (
    1 ===
    (await database.WebhookFailures.destroy({
      where: {
        id
      }
    }))
  );
}

export async function deleteAllWebhookFailures(
  database: DatabaseType
): Promise<boolean> {
  await database.WebhookFailures.destroy({
    truncate: true
  });
  return true;
}
