// @flow
import path from 'path';
import fs from 'fs-extra';
import { type Model } from 'sequelize';

export type DatabaseType = {
  Credentials: Model<any>,
  MigrationProjects: Model<any>,
  MigrationQueue: Model<any>,
  MigrationFailures: Model<any>,
  MigrationIssues: Model<any>,
  MigrationLabels: Model<any>,
  MigrationMilestones: Model<any>,
  MigrationUsers: Model<any>,
  MigrationMappings: Model<any>,
  MigrationMappingVersions: Model<any>,
  MigrationMappingIssueTypes: Model<any>,
  MigrationMappingPriorities: Model<any>,
  MigrationMappingStatuses: Model<any>,
  MigrationMappingComponents: Model<any>,
  WebhookClients: Model<any>,
  WebhookFailures: Model<any>,
  WebhookQueue: Model<any>,
  WebhookStatuses: Model<any>,
  WebhookTransitionMaps: Model<any>,
  WebhookTransitions: Model<any>,
  WebhookDefaultTransitionMaps: Model<any>
};

export default function initializeDatabase(sequelize: *): Promise<void> {
  return Promise.all(
    fs.readdirSync(path.join(__dirname, './')).map((fileName) => {
      if (fileName === 'index.js' || !/\.js$/.test(fileName)) return;
      // $FlowFixMe
      const importedFile = require(`./${fileName}`);
      const postInit = importedFile.postInit;
      const modelDefinition = importedFile.default || importedFile;
      const modelName = fileName.replace(/\..*/gi, '');
      sequelize.define(modelName, ...modelDefinition);
      return postInit;
    })
  ).then((postFunctions) =>
    Promise.all(
      postFunctions.map((func) => func && func(sequelize.models))
    ).then(() => {
      return sequelize.sync();
    })
  );
}
