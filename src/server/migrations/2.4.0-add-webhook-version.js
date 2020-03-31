const { DataTypes } = require('sequelize');

module.exports = {
  up: (queryInterface) => {
    return queryInterface.addColumn(
      'WebhookStatuses',
      'version',
      DataTypes.STRING,
      { defaultValue: '0.0.0' }
    );
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('WebhookStatuses', 'version');
  }
};
