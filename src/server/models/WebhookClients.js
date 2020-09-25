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
    },
    projectId: {
      type: new DataTypes.VIRTUAL(DataTypes.STRING, ['key']),
      get() {
        try {
          return this.get('key').split('-').slice(-1)[0];
        } catch (e) {
          console.error(e);
          // this shouldn't ever really happen
          return '';
        }
      }
    }
  }
];
