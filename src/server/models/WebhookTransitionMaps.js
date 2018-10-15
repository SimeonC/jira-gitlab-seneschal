import { DataTypes } from 'sequelize';

export default [
  {
    jiraProjectKey: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
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
