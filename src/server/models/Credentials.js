import { DataTypes } from 'sequelize';

export default [
  {
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false
    },
    appUrl: {
      type: DataTypes.STRING,
      allowNull: true
    }
  },
  {
    indexes: [
      {
        fields: ['key'],
        unique: true
      }
    ]
  }
];
