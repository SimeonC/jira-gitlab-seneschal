import { DataTypes } from 'sequelize';

export default [
  {
    jiraProjectId: {
      type: DataTypes.NUMBER,
      allowNull: false,
      primaryKey: true
    },
    jiraProjectKey: {
      type: DataTypes.STRING,
      allowNull: false
    },
    openStatusIds: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false
    },
    mergeStatusIds: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false
    },
    closeStatusIds: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false
    }
  }
];
