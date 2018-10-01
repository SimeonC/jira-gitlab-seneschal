// @flow
import sortedIndexBy from 'lodash/sortedIndexBy';
import lowdbEncrypted from '../lowdb/encrypted';
import lowdb from '../lowdb';

export const WEBHOOK_TYPES = {
  COMMENTS: 'note',
  MERGE_REQUESTS: 'merge_request'
};
export const WEBHOOK_TYPE_KEYS: string[] = Object.keys(WEBHOOK_TYPES).map(
  (key) => WEBHOOK_TYPES[key]
);

export function isValidWebhookType(type: WebhookType | string): boolean {
  return WEBHOOK_TYPE_KEYS.indexOf(type) !== -1;
}

export type WebhookType = $Values<typeof WEBHOOK_TYPES>;

export const WEBHOOK_ICON_MAP_WIP_KEY = 'wip';

export type WebhookCredentialType = {
  secretKey: string,
  clientKey: string
};

type WebhookTransitionsType = {
  mergeId: string,
  openId: string,
  closeId: string
};

export type WebhookMetadataType = {
  transitionKeywords: string[],
  // this is a map of jiraProjectKey to transitionId
  transitionMap: {
    jiraProjectKey: string,
    transitionStatusIds: WebhookTransitionsType
  }[]
};

export type WebhookProjectStatusEnumType = 'pending' | 'healthy' | 'sick';

export type WebhookProjectStatusType = {
  id: string,
  name: string,
  url: string,
  status: WebhookProjectStatusEnumType
};

function loadDb(password: string) {
  return lowdbEncrypted('webhooks', { hooks: {} }, password);
}

function loadStatusDb() {
  return lowdb('webhooksStatus', { projects: [] });
}

function loadMetadataDb() {
  return lowdb('webhooksMetadata', {
    __default: {
      transitionKeywords: [
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
      ],
      transitionMap: []
    }
  });
}

export function getWebhookMetadata(
  clientKey: string,
  force: boolean = false
): WebhookMetadataType {
  const db = loadMetadataDb();
  const clientValue = db.get(clientKey).value();
  if (!clientValue && !force) {
    throw new Error('Webhook has not been setup for this clientKey');
  }
  const defaultValue = db.get('__default').value();
  return {
    ...defaultValue,
    ...(clientValue || {})
  };
}

export function setWebhookMetadata(
  clientKey: string,
  metadata: WebhookMetadataType
) {
  loadMetadataDb()
    .set(clientKey, metadata)
    .write();
}

export function registerProject(
  projectId: string,
  projectName: string,
  projectUrl: string
) {
  updateProject(projectId, {
    name: projectName,
    url: projectUrl,
    status: 'pending'
  });
}

export function updateProject(
  projectId: string,
  props: { name?: string, url?: string, status?: WebhookProjectStatusEnumType }
) {
  const db = loadStatusDb();
  const current = db.get('projects').value();
  const newProject: WebhookProjectStatusType = {
    id: `${projectId}`,
    ...props
  };
  const insertIndex = sortedIndexBy(current, newProject, 'id');
  const isExisting =
    current[insertIndex] && current[insertIndex].id === newProject.id;
  let updatedProject = newProject;
  if (isExisting) {
    updatedProject = {
      ...current[insertIndex],
      ...newProject
    };
  }
  current.splice(insertIndex, isExisting ? 1 : 0, updatedProject);
  db.set('projects', current).write();
  return true;
}

export function allProjects(): WebhookProjectStatusType[] {
  return loadStatusDb()
    .get('projects')
    .value();
}

export function getWebhookClientKey(
  password: string,
  key: string,
  secretKey: string
) {
  const credential: WebhookCredentialType = loadDb(password)
    .get(`hooks.${key}`)
    .value();
  if (credential.secretKey === secretKey) {
    return credential.clientKey;
  }
  throw new Error(`Invalid secret key for webhook "${key}"`);
}

export function isValidSecretKey(
  password: string,
  key: string,
  secretKey: string
) {
  try {
    getWebhookClientKey(password, key, secretKey);
    return true;
  } catch (error) {
    return false;
  }
}

export function setWebhookClientKey(
  password: string,
  key: string,
  secretKey: string,
  clientKey: string
) {
  loadDb(password)
    .set(`hooks.${key}`, { secretKey, clientKey })
    .write();
}
