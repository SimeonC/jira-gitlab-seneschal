import { DataTypes } from 'sequelize';

export default [
  {
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    appUrl: {
      type: DataTypes.TEXT,
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
