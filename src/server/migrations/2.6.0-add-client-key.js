const { jiraRequest } = require('../apis/jira');

module.exports = {
  up: async (queryInterface, jiraAddon) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "MigrationQueues" ADD COLUMN IF NOT EXISTS "clientKey" VARCHAR(255) NOT NULL;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "MigrationQueues" DROP COLUMN "clientKey";
    `);
  }
};
