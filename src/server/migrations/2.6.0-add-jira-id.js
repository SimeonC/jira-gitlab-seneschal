const { jiraRequest } = require('../apis/jira');

module.exports = {
  up: async (queryInterface, jiraAddon) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "WebhookTransitionMaps" ADD COLUMN IF NOT EXISTS "jiraProjectId" VARCHAR(255);
    `);
    try {
      await queryInterface.removeConstraint('WebhookTransitionMaps', 'WebhookTransitionMaps_pkey');
    } catch (e) {
      // if we can't remove it it doesn't exist!
    }
    const [allMaps] = await queryInterface.sequelize.query(`
      SELECT * FROM "WebhookTransitionMaps"
    `);
    await Promise.all(allMaps.map(async ({ jiraProjectKey, clientKey }) => {
      const jiraApi = jiraAddon.httpClient({ clientKey });
      const jiraProject = await jiraRequest(jiraApi, 'get', `/project/${jiraProjectKey}`);
      await queryInterface.sequelize.query(`
        UPDATE "WebhookTransitionMaps" SET "jiraProjectId" = ${jiraProject.id} WHERE "jiraProjectKey" = '${jiraProjectKey}'
      `);
    }));
    await queryInterface.sequelize.query(`
      ALTER TABLE "WebhookTransitionMaps" ALTER COLUMN "jiraProjectId" SET NOT NULL;
    `);
    await queryInterface.addConstraint('WebhookTransitionMaps', {
      fields: ['jiraProjectId'],
      type: 'primary key',
      name: 'WebhookTransitionMaps_pkey'
    });
  },

  down: async () => {
    await queryInterface.removeConstraint('WebhookTransitionMaps', 'WebhookTransitionMaps_pkey');
    await queryInterface.sequelize.query(`
      ALTER TABLE "WebhookTransitionMaps" DROP COLUMN "jiraProjectId";
    `);
    await queryInterface.addConstraint('WebhookTransitionMaps', {
      fields: ['jiraProjectKey'],
      type: 'primary key',
      name: 'WebhookTransitionMaps_pkey'
    });
  }
};
