export const WEBHOOK_SETTING_KEYS = {
  AUTO_ADD: 'autoAdd'
};

const validKeys = Object.keys(WEBHOOK_SETTING_KEYS).map(
  (key) => WEBHOOK_SETTING_KEYS[key]
);

export default function initWebhookSettings(jiraAddon: *) {
  const database = jiraAddon.schema.models;

  async function getWebhookSettings(root: *, args: *, req: *) {
    const allSettings = await database.WebhookSettings.findAll({
      where: {
        clientKey: req.context.clientKey
      }
    });
    return allSettings.reduce((result, { key, value }) => {
      result[key] = value;
      return result;
    }, {});
  }

  async function setWebhookSetting(
    root: *,
    { key, value }: { key: string, value: string },
    req: *
  ) {
    if (validKeys.indexOf(key) === -1)
      throw new Error(
        `Only the following keys are valid; ${validKeys.join(', ')}`
      );
    await database.WebhookSettings.upsert({
      clientKey: req.context.clientKey,
      key,
      value
    });
    return { success: true };
  }

  async function deleteWebhookSetting(
    root: *,
    { key }: { key: string },
    req: *
  ) {
    await database.WebhookSettings.destroy({
      clientKey: req.context.clientKey,
      key
    });
    return { success: true };
  }

  return {
    getWebhookSettings,
    setWebhookSetting,
    deleteWebhookSetting
  };
}
