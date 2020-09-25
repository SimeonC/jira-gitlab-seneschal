// @flow
import kebabCase from 'lodash/kebabCase';
import {
  isValidSecretKey,
  isValidWebhookType,
  parseProjectProps,
  registerProject,
  setWebhookClientKey
} from '../apis/webhooks';
import type { DatabaseType } from '../models';
import { enqueueWebhook } from './queue';
import gitlabApi, {
  getAllProjects as getAllGitlabProjects
} from '../apis/gitlab';
import type { GitlabCredential } from '../apis/credentials';
import { getCredential } from '../apis/credentials';
import { encrypt } from '../utils/encryption';
import getAppUrl from '../utils/getAppUrl';
import type { WebhookProjectStatusType } from '../apis/webhooks.types';
import { version } from '../../../package.json';
import { WEBHOOK_SETTING_KEYS } from './settings';

const GITLAB_SECRET_TOKEN_PASSWORD = 'D+_"WqXsx_#]indVNBP?M3*7?/bnt&hB';

async function getWebhookKey(jiraApp, gitlabProjectId, clientKey) {
  const { appUrl }: GitlabCredential = (await getCredential(
    jiraApp,
    `${clientKey}_gitlab`
  ): any);

  return `${kebabCase(
    appUrl.replace(/^http(s|):\/\//, '')
  )}-${gitlabProjectId}`;
}

function getExistingWebhooks(webhooks, key) {
  return webhooks.filter(({ url }) => url.indexOf(`/webhooks/${key}`) >= 0);
}

export async function createWebhooks(
  jiraApp: *,
  gitlabProjectId: string,
  clientKey: string,
  status?: string = 'pending'
): WebhookProjectStatusType {
  const database: DatabaseType = jiraApp.schema.models;
  const gitlab = await gitlabApi(jiraApp, clientKey);
  const currentProjectWebhooks = await gitlab.ProjectHooks.all(gitlabProjectId);

  const key = await getWebhookKey(jiraApp, gitlabProjectId, clientKey);
  const secretKey = encrypt(key, GITLAB_SECRET_TOKEN_PASSWORD);

  const webhookUrl = `${getAppUrl()}/webhooks/${key}`;
  const webhookSettings = {
    merge_requests_events: true,
    note_events: true,
    token: secretKey,
    // These should be all defaulted but here for easy reference
    push_events: false,
    tag_push_events: false,
    repository_update_events: false,
    enable_ssl_verification: false,
    issues_events: false,
    confidential_issues_events: false,
    confidential_note_events: null,
    pipeline_events: false,
    wiki_page_events: false,
    job_events: false
  };

  const existingWebhooks = getExistingWebhooks(currentProjectWebhooks, key);
  if (existingWebhooks.length === 1) {
    await gitlab.ProjectHooks.edit(
      gitlabProjectId,
      existingWebhooks[0].id,
      webhookUrl,
      webhookSettings
    );
  } else {
    if (existingWebhooks.length > 1) {
      // cleanup if we have many matching hooks - not usual unless something has added multiple versions of same hook
      await Promise.all(
        existingWebhooks.map((existingWebhook) =>
          gitlab.ProjectHooks.remove(gitlabProjectId, existingWebhook.id)
        )
      );
    }
    await gitlab.ProjectHooks.add(gitlabProjectId, webhookUrl, webhookSettings);
  }

  const { web_url, name_with_namespace } = await gitlab.Projects.show(
    gitlabProjectId
  );
  await registerProject(
    database,
    gitlabProjectId,
    name_with_namespace,
    web_url,
    status
  );
  await setWebhookClientKey(database, key, secretKey, clientKey);

  // $FlowFixMe
  return {
    id: gitlabProjectId,
    name: name_with_namespace,
    url: web_url,
    status,
    version
  };
}

async function checkWebhook(jiraAddon: *, client: *) {
  const database = jiraAddon.schema.models;
  const { key: currentKey, clientKey, projectId: gitlabProjectId } = client;

  const gitlab = await gitlabApi(jiraAddon, clientKey);
  const {
    name,
    url,
    status,
    outOfDate
  } = await database.WebhookStatuses.findOne({
    where: {
      id: gitlabProjectId
    }
  });
  let project;
  try {
    project = await gitlab.Projects.show(gitlabProjectId);
  } catch (e) {}
  if (!project) {
    // project has been removed from gitlab
    await database.WebhookStatuses.destroy({
      where: { id: gitlabProjectId }
    });
    return;
  }
  const key = await getWebhookKey(jiraAddon, gitlabProjectId, clientKey);
  const currentProjectWebhooks = await gitlab.ProjectHooks.all(gitlabProjectId);

  const existingWebhooks = getExistingWebhooks(currentProjectWebhooks, key);
  const correctWebhookUrl = `${getAppUrl()}/webhooks/${key}`;
  const {
    name_with_namespace: gitlabName,
    web_url: gitlabProjectUrl
  } = project;
  const { url: gitlabUrl } = parseProjectProps({
    url: gitlabProjectUrl
  });
  if (
    !outOfDate &&
    gitlabName === name &&
    gitlabUrl === url &&
    existingWebhooks.length === 1 &&
    existingWebhooks[0].url === correctWebhookUrl
  ) {
    return;
  }
  // $FlowFixMe - server ensures APP_URL exists
  await createWebhooks(jiraAddon, gitlabProjectId, clientKey, status);
  if (key !== currentKey) {
    await database.WebhookClients.destroy({
      where: {
        key: currentKey
      }
    });
  }
}

async function checkExistingWebhooks(jiraAddon: *) {
  const database = jiraAddon.schema.models;
  try {
    const webhookClients = await database.WebhookClients.findAll();

    const {
      duplicate: duplicateClients,
      unique: uniqueClients
    } = webhookClients.reduce(
      (result, client, index) => {
        if (result.duplicate.indexOf(client) !== -1) return result;
        let isUnique = true;
        for (let i = index + 1; i < webhookClients.length; i += 1) {
          if (
            webhookClients[i].projectId === client.projectId &&
            webhookClients[i].clientKey === client.clientKey
          ) {
            result.duplicate.push(client);
            result.duplicate.push(webhookClients[i]);
            isUnique = false;
          }
        }
        if (isUnique) {
          result.unique.push(client);
        }
        return result;
      },
      { duplicate: [], unique: [] }
    );

    const uniquePromises = uniqueClients.map((client) =>
      checkWebhook(jiraAddon, client)
    );
    const duplicatePromises = duplicateClients
      .reduce(async (projectIds, client) => {
        const {
          key: currentKey,
          clientKey,
          projectId: gitlabProjectId
        } = client;
        await database.WebhookClients.destroy({
          where: {
            key: currentKey
          }
        });
        if (projectIds.indexOf(gitlabProjectId) === -1) {
          projectIds.push([gitlabProjectId, clientKey]);
        }
        return projectIds;
      }, [])
      .map(([projectId, clientKey]) =>
        createWebhooks(jiraAddon, projectId, clientKey)
      );

    await Promise.all(uniquePromises.concat(duplicatePromises));
  } catch (error) {
    console.error(error);
  }
}

async function checkForNewProjects(jiraAddon) {
  const database = jiraAddon.schema.models;
  const allSettings = await database.WebhookSettings.findAll({
    where: {
      key: WEBHOOK_SETTING_KEYS.AUTO_ADD
    }
  });
  return Promise.all(
    allSettings.map(async ({ clientKey, value }) => {
      if (value !== 'true') return;
      const allProjects = await getAllGitlabProjects(jiraAddon, clientKey);
      const allRegisteredWebhooks = await database.WebhookStatuses.findAll();
      const newProjects = [];
      for (let i = 0; i < allProjects.length; i += 1) {
        let hasFoundRegistered = false;
        for (let w = 0; w < allRegisteredWebhooks.length; w += 1) {
          if (
            allProjects[i].id.toString() ===
            allRegisteredWebhooks[w].id.toString()
          ) {
            hasFoundRegistered = true;
            break;
          }
        }
        if (!hasFoundRegistered) {
          newProjects.push(allProjects[i]);
        }
      }
      await Promise.all(
        newProjects.map(({ id }) => createWebhooks(jiraAddon, id, clientKey))
      );
    })
  );
}

export async function runWebhookChecks(jiraAddon: *) {
  await Promise.all([
    checkExistingWebhooks(jiraAddon),
    checkForNewProjects(jiraAddon)
  ]);
}

function scheduleCheck(jiraAddon) {
  setTimeout(() => {
    runWebhookChecks(jiraAddon);
    scheduleCheck(jiraAddon);
    // run every 24 hours
  }, 1000 * 60 * 60 * 24);
}

export default function webhooksSetup(jiraAddon: *, expressApp: *) {
  scheduleCheck(jiraAddon);

  expressApp.post('/webhooks/:key', (req, res) => {
    res.status(200);
    try {
      const { key } = req.params;
      const secretKey = req.get('X-Gitlab-Token');
      const webhookEventType = req.body.object_kind;
      if (
        isValidWebhookType(webhookEventType) &&
        secretKey &&
        isValidSecretKey(jiraAddon.schema.models, key, secretKey)
      ) {
        enqueueWebhook(jiraAddon, {
          key,
          secretKey,
          body: req.body
        });
      }
      return res.send('success');
    } catch (error) {
      console.error(error);
      // Webhooks must be successful or they retry!
      return res.send('failed with error logged');
    }
  });
}
