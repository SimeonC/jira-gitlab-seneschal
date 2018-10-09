// @flow
import compact from 'lodash/compact';
import unique from 'lodash/uniq';
import uniqueBy from 'lodash/uniqBy';
import mapKeys from 'lodash/mapKeys';
import camelCase from 'lodash/camelCase';
import GitlabApi from '../apis/gitlab';
import transitionProjectApi from '../apis/transitionProject';
import lowdb from '../lowdb';

export type MessageType = {
  encryptionKey: string,
  projectId: string
};

process.on('message', (message: MessageType) => {
  if (message.projectId) {
    loadGitlabProjectIssues(message.encryptionKey, message.projectId);
  } else {
    processIssues(message.encryptionKey);
  }
});

function getMigrationQueueDb(encryptionKey: string) {
  return lowdb(encryptionKey, 'migrationQueue', {
    queue: [],
    failures: [],
    processingProjects: {}
  });
}

let isProcessing = false;

function getProjectToProcess(encryptionKey: string) {
  const projects = getMigrationQueueDb(encryptionKey)
    .get('processingProjects')
    .value();
  const projectKeys = Object.keys(projects).sort();
  const projectId = projectKeys.find((key) => projects[key].isLoading);
  return projects[projectId];
}

function processIssues(encryptionKey: string) {
  if (isProcessing) return;
  isProcessing = true;
  let project = getProjectToProcess(encryptionKey);
  while (project) {
    processIssue(
      encryptionKey,
      project.projectId,
      project.completedCount,
      project.totalCount
    );
    project = getProjectToProcess(encryptionKey);
  }
  isProcessing = false;
}

function processIssue(
  encryptionKey: string,
  projectId: string,
  index: number,
  totalIssues: number
) {
  const transitionProjectDb = transitionProjectApi(encryptionKey, projectId);
  const issue = transitionProjectDb.get(`issues[${index}]`).value();
  const labels = transitionProjectDb.get('labels').value();
  transitionProjectDb
    .set('labels', unique(labels.concat(issue.labels || [])))
    .write();
  if (issue.milestone) {
    const milestones = transitionProjectDb.get('milestones').value();
    transitionProjectDb
      .set('milestones', uniqueBy(milestones.concat([issue.milestone]), 'id'))
      .write();
  }
  const allUsers = transitionProjectDb.get('users').value();
  const issueUsers = issue.assignees || [];
  issueUsers.push(issue.author);
  issueUsers.push(issue.assignee);
  transitionProjectDb
    .set('users', uniqueBy(allUsers.concat(compact(issueUsers)), 'id'))
    .write();
  getMigrationQueueDb(encryptionKey)
    .set(`processingProjects.${projectId}.completedCount`, index + 1)
    .write();
  if (index + 1 >= totalIssues) {
    getMigrationQueueDb(encryptionKey)
      .set(`processingProjects.${projectId}.isProcessing`, false)
      .set(`processingProjects.${projectId}.isLoading`, false)
      .set(`processingProjects.${projectId}.completedCount`, 0)
      .write();
  }
}

async function loadGitlabProjectIssues(
  encryptionKey: string,
  projectId: string
) {
  const migrationDb = getMigrationQueueDb(encryptionKey);
  migrationDb
    .set(`processingProjects.${projectId}`, {
      projectId,
      isProcessing: false,
      isLoading: true,
      completedCount: 0,
      totalCount: 1,
      gitlabProjectName: 'Loading...',
      currentMessage: 'Loading'
    })
    .write();
  const gitlabApi = GitlabApi(encryptionKey);
  const transitionProjectDb = transitionProjectApi(encryptionKey, projectId);
  const projectMeta = await gitlabApi.Projects.show(projectId);
  migrationDb
    .set(
      `processingProjects.${projectId}.gitlabProjectName`,
      projectMeta.path_with_namespace
    )
    .write();
  transitionProjectDb
    .set('meta', mapKeys(projectMeta, (value, key) => camelCase(key)))
    .write();
  const issues = await gitlabApi.Issues.all({
    projectId
  });
  migrationDb
    .set(`processingProjects.${projectId}.totalCount`, issues.length)
    .write();
  transitionProjectDb.set('issues', issues).write();

  if (issues.length) {
    processIssues(encryptionKey);
  }
}
