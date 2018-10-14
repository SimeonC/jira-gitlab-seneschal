import { DataTypes } from 'sequelize';

export default [
  {
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    secretKey: {
      type: DataTypes.STRING,
      allowNull: false
    },
    clientKey: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }
];
