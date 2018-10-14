import { DataTypes } from 'sequelize';

export default [
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    iid: {
      type: DataTypes.INTEGER
    },
    projectId: {
      type: DataTypes.STRING
    },
    title: {
      type: DataTypes.TEXT
    },
    description: {
      type: DataTypes.TEXT
    },
    state: {
      type: DataTypes.STRING
    },
    labels: {
      type: DataTypes.ARRAY(DataTypes.STRING)
    },
    milestone: {
      type: DataTypes.JSON
    },
    assignees: {
      type: DataTypes.ARRAY(DataTypes.JSON)
    },
    assignee: {
      type: DataTypes.JSON
    },
    author: {
      type: DataTypes.JSON
    },
    closedBy: {
      type: DataTypes.JSON
    },
    upvotes: {
      type: DataTypes.INTEGER
    },
    downvotes: {
      type: DataTypes.INTEGER
    },
    userNotesCount: {
      type: DataTypes.INTEGER
    },
    dueDate: {
      type: DataTypes.STRING
    },
    confidential: {
      type: DataTypes.BOOLEAN
    },
    discussionLocked: {
      type: DataTypes.BOOLEAN
    },
    webUrl: {
      type: DataTypes.STRING
    },
    weight: {
      type: DataTypes.INTEGER
    },
    timeStats: {
      type: DataTypes.JSON
    }
  }
];
