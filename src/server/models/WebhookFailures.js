import { DataTypes } from 'sequelize';

export default [
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    original: {
      type: DataTypes.JSON,
      allowNull: false
    },
    error: {
      type: DataTypes.JSON,
      allowNull: false
    }
  }
];
