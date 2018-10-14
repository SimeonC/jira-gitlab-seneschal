import { DataTypes } from 'sequelize';

export default [
  {
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    jiraProjectId: {
      type: DataTypes.JSON,
      allowNull: false
    },
    defaultComponentIds: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: false
    },
    defaultIssueTypeId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    defaultIssueTypeClosedStatusId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    defaultResolutionId: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }
];
