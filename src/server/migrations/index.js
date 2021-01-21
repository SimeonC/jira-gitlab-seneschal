import path from 'path';
import Umzug from 'umzug';
import Bluebird from 'bluebird';
import helpers from 'sequelize-cli/lib/helpers/index';

export function logMigrator(s) {
  if (s.indexOf('Executing') !== 0) {
    helpers.view.log(s);
  }
}

export function getMigrator(sequelize, jiraAddon) {
  return Bluebird.try(() => {
    const migrator = new Umzug({
      storage: 'sequelize',
      storageOptions: { sequelize },
      logging: helpers.view.log,
      migrations: {
        params: [sequelize.getQueryInterface(), jiraAddon],
        path: path.resolve(
          `./${
            process.env.NODE_ENV === 'production' ? 'build' : 'src'
          }/server/migrations`
        ),
        pattern: /^((?!^index\.).)*\.js/,
        wrap: (fun) => {
          if (fun.length === 3) {
            return Bluebird.promisify(fun);
          } else {
            return fun;
          }
        }
      }
    });

    return sequelize
      .authenticate()
      .then(() => {
        // Check if this is a PostgreSQL run and if there is a custom schema specified, and if there is, check if it's
        // been created. If not, attempt to create it.
        if (helpers.version.getDialectName() === 'pg') {
          const customSchemaName = helpers.umzug.getSchema('migration');
          if (customSchemaName && customSchemaName !== 'public') {
            return sequelize.createSchema(customSchemaName);
          }
        }

        return Bluebird.resolve();
      })
      .then(() => addTimestampsToSchema(migrator))
      .then(() => migrator)
      .catch((e) => helpers.view.error(e));
  });
}

export function ensureCurrentMetaSchema(migrator) {
  const queryInterface = migrator.options.storageOptions.sequelize.getQueryInterface();
  const tableName = migrator.options.storageOptions.tableName;
  const columnName = migrator.options.storageOptions.columnName;

  return ensureMetaTable(queryInterface, tableName)
    .then((table) => {
      const columns = Object.keys(table);

      if (columns.length === 1 && columns[0] === columnName) {
        return;
      } else if (columns.length === 3 && columns.indexOf('createdAt') >= 0) {
        return;
      }
    })
    .catch(() => {});
}

function ensureMetaTable(queryInterface, tableName) {
  return queryInterface.showAllTables().then((tableNames) => {
    if (tableNames.indexOf(tableName) === -1) {
      throw new Error('No MetaTable table found.');
    }
    return queryInterface.describeTable(tableName);
  });
}

/**
 * Add timestamps
 *
 * @return {Promise}
 */
export function addTimestampsToSchema(migrator) {
  const sequelize = migrator.options.storageOptions.sequelize;
  const queryInterface = sequelize.getQueryInterface();
  const tableName = migrator.options.storageOptions.tableName;

  return ensureMetaTable(queryInterface, tableName).then((table) => {
    if (table.createdAt) {
      return;
    }

    return ensureCurrentMetaSchema(migrator)
      .then(() => queryInterface.renameTable(tableName, tableName + 'Backup'))
      .then(() => {
        const sql = queryInterface.QueryGenerator.selectQuery(
          tableName + 'Backup'
        );
        return helpers.generic.execQuery(sequelize, sql, {
          type: 'SELECT',
          raw: true
        });
      })
      .then((result) => {
        const SequelizeMeta = sequelize.define(
          tableName,
          {
            name: {
              type: Sequelize.STRING,
              allowNull: false,
              unique: true,
              primaryKey: true,
              autoIncrement: false
            }
          },
          {
            tableName,
            timestamps: true,
            schema: helpers.umzug.getSchema()
          }
        );

        return SequelizeMeta.sync().then(() => {
          return SequelizeMeta.bulkCreate(result);
        });
      });
  });
}
