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
    milestoneId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    },
    versionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    }
  }
];
