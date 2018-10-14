import { DataTypes } from 'sequelize';

export default [
  {
    projectId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    }
  }
];
