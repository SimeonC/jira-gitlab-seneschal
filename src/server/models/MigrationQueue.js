import { DataTypes } from 'sequelize';

export default [
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    // Gitlab Project Id
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    },
    issueIid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'compositeIndex'
    }
  }
];
