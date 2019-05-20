import { DataTypes } from 'sequelize';

export default [
  {
    clientKey: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    transitionKeywords: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false
    }
  }
];

export function postInit(database) {
  database.WebhookTransitions.hasMany(database.WebhookTransitionMaps, {
    as: 'transitionMap',
    foreignKey: 'clientKey',
    sourceKey: 'clientKey'
  });
  database.WebhookTransitions.hasMany(database.WebhookDefaultTransitionMaps, {
    as: 'defaultTransitionMap',
    foreignKey: 'clientKey',
    sourceKey: 'clientKey'
  });
}
