// @flow
import kebabCase from 'lodash/kebabCase';
import {
  allProjects,
  isValidSecretKey,
  isValidWebhookType,
  parseProjectProps,
  registerProject,
  setWebhookClientKey
} from '../apis/webhooks';
import type { DatabaseType } from '../models';
import { enqueueWebhook } from './queue';
import gitlabApi from '../apis/gitlab';
import type { GitlabCredential } from '../apis/credentials';
import { getCredential } from '../apis/credentials';
import { encrypt } from '../utils/encryption';
import getAppUrl from '../utils/getAppUrl';
import type { WebhookProjectStatusType } from '../apis/webhooks.types';
import { version } from '../../../package.json';

const GITLAB_SECRET_TOKEN_PASSWORD = 'D+_"WqXsx_#]indVNBP?M3*7?/bnt&hB';

async function getWebhookKey(jiraApp, gitlabProjectId) {
  const { appUrl }: GitlabCredential = (await getCredential(
    jiraApp,
    'gitlab'
  ): any);

  return `${kebabCase(
    appUrl.replace(/^http(s|):\/\//, '')
  )}-${gitlabProjectId}`;
}

export async function createWebhooks(
  jiraApp: *,
  gitlabProjectId: string,
  clientKey: string
): WebhookProjectStatusType {
  const database: DatabaseType = jiraApp.schema.models;
  const gitlab = await gitlabApi(jiraApp);
  const currentProjectWebhooks = await gitlab.ProjectHooks.all(gitlabProjectId);

  const key = await getWebhookKey(jiraApp, gitlabProjectId);
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

  const existingWebhook = currentProjectWebhooks.find(
    ({ url }) => url.indexOf(`/${key}`) >= 0
  );
  if (existingWebhook) {
    await gitlab.ProjectHooks.edit(
      gitlabProjectId,
      existingWebhook.id,
      webhookUrl,
      webhookSettings
    );
  } else {
    await gitlab.ProjectHooks.add(gitlabProjectId, webhookUrl, webhookSettings);
  }

  const { web_url, name_with_namespace } = await gitlab.Projects.show(
    gitlabProjectId
  );
  await registerProject(
    database,
    gitlabProjectId,
    name_with_namespace,
    web_url
  );
  await setWebhookClientKey(database, key, secretKey, clientKey);

  // $FlowFixMe
  return {
    id: gitlabProjectId,
    name: name_with_namespace,
    url: web_url,
    status: 'pending',
    version
  };
}

export async function checkExistingWebhooks(jiraAddon: *) {
  try {
    const webhooks = await allProjects(jiraAddon.schema.models);
    const gitlab = await gitlabApi(jiraAddon);
    return Promise.all(
      webhooks.map(
        async ({ id: gitlabProjectId, name, url, outOfDate, clientKey }) => {
          let project;
          try {
            project = await gitlab.Projects.show(gitlabProjectId);
          } catch (e) {}
          if (!project) {
            // project has been removed from gitlab
            await jiraAddon.schema.models.WebhookStatuses.destroy({
              where: { id: gitlabProjectId }
            });
            return;
          }
          const key = await getWebhookKey(jiraAddon, gitlabProjectId);
          const currentProjectWebhooks = await gitlab.ProjectHooks.all(
            gitlabProjectId
          );
          const existingWebhook = currentProjectWebhooks.find(
            ({ url }) => url.indexOf(`/${key}`) >= 0
          );
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
            existingWebhook.url === correctWebhookUrl
          )
            return;
          // $FlowFixMe - server ensures APP_URL exists
          await createWebhooks(jiraAddon, gitlabProjectId, clientKey);
        }
      )
    );
  } catch (error) {
    console.error(error);
  }
}

function scheduleCheck(jiraAddon) {
  setTimeout(() => {
    checkExistingWebhooks(jiraAddon);
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
