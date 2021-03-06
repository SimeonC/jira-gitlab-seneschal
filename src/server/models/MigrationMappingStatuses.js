import { DataTypes } from 'sequelize';

export default [
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    },
    gitlabLabel: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    },
    issueTypeId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    },
    statusId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    }
  }
];
