import semver from 'semver';
import { DataTypes } from 'sequelize';
import { version } from '../../../package';

const currentMinorVersion = version
  .split('.')
  .slice(0, 2)
  .join('.');

export default [
  {
    id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: version
    },
    outOfDate: {
      type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['version']),
      get() {
        try {
          const hookVersion = this.get('version');
          return (
            !hookVersion || semver.lt(hookVersion, `${currentMinorVersion}.0`)
          );
        } catch (e) {
          console.error(e);
          return true;
        }
      }
    }
  }
];
