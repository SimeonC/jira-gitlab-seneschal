const { encryptKeys, decryptKeys } = require('../apis/credentials');

module.exports = {
  up: async (queryInterface, jiraAddon) => {
    const credentials = await queryInterface.sequelize.models.Credentials.findAll();
    const promises = credentials.map((credential) => {
      queryInterface.sequelize.query(
        `
      UPDATE "Credentials"
      SET "token" = :token,
          "appUrl" = :appUrl
      WHERE "key" = :key
    `,
        {
          replacements: encryptKeys(
            jiraAddon.config.CREDENTIAL_ENCRYPTION_KEY(),
            credential
          )
        }
      );
    });

    return await Promise.all(promises);
  },

  down: async (queryInterface, jiraAddon) => {
    const credentials = await queryInterface.sequelize.findAll('Credentials');
    const promises = credentials.map((credential) => {
      queryInterface.sequelize.query(
        `
      UPDATE "Credentials"
      SET "token" = :token,
          "appUrl" = :appUrl
      WHERE key = :key
    `,
        {
          replacements: decryptKeys(
            jiraAddon.config.CREDENTIAL_ENCRYPTION_KEY(),
            credential
          )
        }
      );
    });

    return await Promise.all(promises);
  }
};
