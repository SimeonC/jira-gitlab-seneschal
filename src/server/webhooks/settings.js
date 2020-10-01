// @flow
import { Op } from 'sequelize';

export const WEBHOOK_SETTING_KEYS = {
  AUTO_ADD: 'autoAdd',
  ENABLE_UPDATE_ON_EDITS: 'enableUpdateOnEdits',
  USE_DESCRIPTION_TRANSITIONS: 'useDescriptionTransitions'
};

const validKeys = Object.keys(WEBHOOK_SETTING_KEYS).map(
  (key) => WEBHOOK_SETTING_KEYS[key]
);

export async function getWebhookSettings(
  jiraAddon: *,
  clientKey: string,
  jiraProjectIdParam?: string,
  gitlabProjectIdParam?: string
) {
  const where = {
    clientKey,
    [Op.or]: [
      {
        jiraProjectId: {
          [Op.eq]: null
        },
        gitlabProjectId: {
          [Op.eq]: null
        }
      }
    ]
  };
  if (jiraProjectIdParam && !gitlabProjectIdParam) {
    where[Op.or].push({ jiraProjectId: jiraProjectIdParam });
  } else if (!jiraProjectIdParam && gitlabProjectIdParam) {
    where[Op.or].push({ gitlabProjectId: gitlabProjectIdParam });
  } else if (jiraProjectIdParam && gitlabProjectIdParam) {
    where[Op.or].push({
      gitlabProjectId: gitlabProjectIdParam,
      jiraProjectId: jiraProjectIdParam
    });
  }
  const allSettings = await jiraAddon.schema.models.WebhookSettings.findAll({
    where
  });
  return allSettings.reduce(
    (result, { key, value, jiraProjectId, gitlabProjectId }) => {
      if (
        !jiraProjectId &&
        !gitlabProjectId &&
        typeof result[key] !== 'undefined'
      )
        return;
      result[key] = value;
      return result;
    },
    {}
  );
}

export default function initWebhookSettings(jiraAddon: *) {
  const database = jiraAddon.schema.models;

  async function internalGetWebhookSettings(
    root: *,
    {
      jiraProjectId,
      gitlabProjectId
    }: { jiraProjectId?: string, gitlabProjectId?: string },
    req: *
  ) {
    return getWebhookSettings(
      jiraAddon,
      req.context.clientKey,
      jiraProjectId,
      gitlabProjectId
    );
  }

  async function setWebhookSetting(
    root: *,
    {
      key,
      value,
      jiraProjectId,
      gitlabProjectId
    }: {
      key: string,
      value: string,
      jiraProjectId?: string,
      gitlabProjectId?: string
    },
    req: *
  ) {
    if (validKeys.indexOf(key) === -1)
      throw new Error(
        `Only the following keys are valid; ${validKeys.join(', ')}`
      );
    await database.WebhookSettings.upsert({
      clientKey: req.context.clientKey,
      key,
      value,
      jiraProjectId,
      gitlabProjectId
    });
    return { success: true };
  }

  async function deleteWebhookSetting(
    root: *,
    {
      key,
      jiraProjectId,
      gitlabProjectId
    }: { key: string, jiraProjectId?: string, gitlabProjectId?: string },
    req: *
  ) {
    await database.WebhookSettings.destroy({
      clientKey: req.context.clientKey,
      key,
      jiraProjectId: jiraProjectId || {
        [Op.eq]: null
      },
      gitlabProjectId: gitlabProjectId || {
        [Op.eq]: null
      }
    });
    return { success: true };
  }

  return {
    getWebhookSettings: internalGetWebhookSettings,
    setWebhookSetting,
    deleteWebhookSetting
  };
}
