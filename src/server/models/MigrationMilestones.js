import { DataTypes } from 'sequelize';

export default [
  {
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    iid: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dueDate: {
      type: DataTypes.STRING,
      allowNull: true
    },
    startdate: {
      type: DataTypes.STRING,
      allowNull: true
    },
    webUrl: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }
];
