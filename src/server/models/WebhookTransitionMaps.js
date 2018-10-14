import { DataTypes } from 'sequelize';

export default [
  {
    jiraProjectKey: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    transitionStatusIds: {
      type: DataTypes.JSON,
      allowNull: false
    }
  }
];
