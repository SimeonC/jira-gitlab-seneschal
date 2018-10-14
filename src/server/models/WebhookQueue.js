import { DataTypes } from 'sequelize';

export default [
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    secretKey: {
      type: DataTypes.STRING,
      allowNull: false
    },
    body: {
      type: DataTypes.JSON,
      allowNull: false
    }
  }
];
