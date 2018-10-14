import { DataTypes } from 'sequelize';

export default [
  {
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true
    },
    isProcessing: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    isLoading: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    completedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    failedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    totalCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    currentMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    currentIssueIid: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }
];
