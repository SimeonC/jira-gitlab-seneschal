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
    priorityId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    }
  }
];
