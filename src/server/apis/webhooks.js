// @flow
import type { DatabaseType } from '../models';
import type {
  WebhookType,
  WebhookCredentialType,
  WebhookTransitionMapsType,
  WebhookProjectStatusType,
  WebhookProjectStatusEnumType,
  WebhookMetadataType
} from './webhooks.types';
import { WEBHOOK_TYPE_KEYS } from './webhooks.types';

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
      }
    ],
    attributes: {
      exclude: ['clientKey']
    }
  });
  if (!transitionMetadata) {
    if (!force) {
      throw new Error('Webhook has not been setup for this clientKey');
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

export async function registerProject(
  database: DatabaseType,
  projectId: string,
  projectName: string,
  projectUrl: string
): Promise<boolean> {
  return await upsertProject(database, projectId, {
    name: projectName,
    url: projectUrl,
    status: 'pending'
  });
}

export async function upsertProject(
  database: DatabaseType,
  projectId: string,
  props: { name: string, url: string, status: WebhookProjectStatusEnumType }
): boolean {
  await database.WebhookStatuses.upsert({
    ...props,
    id: `${projectId}`
  });
  // $FlowFixMe
  return true;
}

export async function updateProject(
  database: DatabaseType,
  projectId: string,
  props: { name?: string, url?: string, status?: WebhookProjectStatusEnumType }
): boolean {
  await database.WebhookStatuses.update(props, {
    where: {
      id: `${projectId}`
    }
  });
  // $FlowFixMe
  return true;
}

export async function allProjects(
  database: DatabaseType
): WebhookProjectStatusType[] {
  // $FlowFixMe
  return await database.WebhookStatuses.findAll();
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
  await database.WebhookClients.create({
    key,
    secretKey,
    clientKey
  });
}
