import { DataTypes } from 'sequelize';

export default [
  {
    clientKey: {
      type: DataTypes.STRING,
      allowNull: false
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false
    },
    jiraProjectId: {
      type: DataTypes.STRING
    },
    gitlabProjectId: {
      type: DataTypes.STRING
    }
  }
];
