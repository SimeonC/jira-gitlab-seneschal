module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "WebhookStatuses" ADD COLUMN IF NOT EXISTS "version" VARCHAR(255)
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "WebhookStatuses" ALTER COLUMN "version" SET DEFAULT '0.0.0'
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('WebhookStatuses', 'version');
  }
};
