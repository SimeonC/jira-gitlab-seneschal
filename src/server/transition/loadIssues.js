// @flow
import Sequelize from 'sequelize';
import logger from 'atlassian-connect-express/lib/internal/logger';
import difference from 'lodash/difference';
import mapKeys from 'map-keys-deep-lodash';
import camelCase from 'lodash/camelCase';
import GitlabApi from '../apis/gitlab';
import initModels, { type DatabaseType } from '../models';
import type { ProcessingProjectType } from './types';

export type MessageType = {
  init?: boolean,
  url?: boolean,
  projectId: string
};

const databasePromise: Promise<DatabaseType> = new Promise((resolve) => {
  process.on('message', (message: MessageType) => {
    try {
      if (message.init) {
        // $FlowFixMe
        const sequelizeDb = new Sequelize(message.url, { logger });
        resolve(initModels(sequelizeDb).then(() => sequelizeDb.models));
        processIssues();
      } else if (message.projectId) {
        loadGitlabProjectIssues(message.projectId);
      }
    } catch (e) {
      console.error(e);
    }
  });
});

let isProcessing = false;

async function getProjectToProcess() {
  const db = await databasePromise;
  const projects = await db.MigrationProjects.findAll({
    where: {
      isLoading: true
    },
    sort: 'projectId'
  });
  return projects[0];
}

async function processIssues() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    let project = await getProjectToProcess();
    while (project) {
      // $FlowFixMe
      await processIssue(project);
      project = await getProjectToProcess();
    }
  } catch (error) {
    console.error(error);
    // $FlowFixMe
    process.send(error.toString());
  } finally {
    isProcessing = false;
  }
}

async function processIssue(project: ProcessingProjectType) {
  const { projectId, completedCount: index, totalCount } = project;
  // $FlowFixMe
  const database = await databasePromise;

  const issue = await database.MigrationIssues.findOne({
    where: {
      projectId
    },
    offset: index
  });
  if (!issue) return;
  const labels = await database.MigrationLabels.findAll({
    where: {
      projectId
    }
  });
  const newLabels = difference(issue.labels, labels.map(({ label }) => label));
  await database.MigrationLabels.bulkCreate(
    newLabels.map((label) => ({ label, projectId }))
  );

  if (issue.milestone) {
    await database.MigrationMilestones.upsert({
      ...mapKeys(issue.milestone, (value, key) => camelCase(key)),
      projectId
    });
  }
  const issueUsers = issue.assignees || [];
  issueUsers.push(issue.author);
  issueUsers.push(issue.assignee);
  issueUsers.forEach(async (user) => {
    await database.MigrationUsers.upsert({
      ...mapKeys(user, (value, key) => camelCase(key)),
      projectId
    });
  });
  const updatedProject = {
    ...project,
    completedCount: index + 1
  };
  if (index + 1 >= totalCount) {
    updatedProject.isProcessing = false;
    updatedProject.isLoading = false;
    updatedProject.completedCount = 0;
  }
  await database.MigrationProjects.update(updatedProject, {
    where: {
      projectId
    }
  });
}

async function loadGitlabProjectIssues(projectId: string) {
  const database = await databasePromise;
  await database.MigrationProjects.create({
    projectId,
    isProcessing: false,
    isLoading: true,
    completedCount: 0,
    failedCount: 0,
    totalCount: 1,
    currentMessage: 'Loading'
  });
  const gitlabApi = await GitlabApi(database, {
    config: {
      CREDENTIAL_ENCRYPTION_KEY: () => process.env.CREDENTIAL_ENCRYPTION_KEY
    }
  });
  const projectMeta = await gitlabApi.Projects.show(projectId);
  // $FlowFixMe
  await database.MigrationProjects.update(
    {
      meta: mapKeys(projectMeta, (value, key) => camelCase(key))
    },
    {
      where: {
        projectId
      }
    }
  );
  const issues = await gitlabApi.Issues.all({
    projectId
  });
  await database.MigrationProjects.update(
    {
      totalCount: issues.length
    },
    {
      where: {
        projectId
      }
    }
  );
  await database.MigrationIssues.bulkCreate(
    issues.map((issue) => ({
      ...mapKeys(issue, (value, key) => camelCase(key)),
      projectId
    }))
  );

  if (issues.length) {
    processIssues();
  }
}
