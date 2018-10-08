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

function processIssues(encryptionKey: string) {
  isProcessing = true;
  while (isProcessing) {
    const projects = getMigrationQueueDb(encryptionKey)
      .get('processingProjects')
      .value();
    const projectKeys = Object.keys(projects).sort();
    const projectId = projectKeys.find((key) => projects[key].isLoading);
    if (!projectId) {
      isProcessing = false;
      return;
    }
    processIssue(
      encryptionKey,
      projectId,
      projects[projectId].completedCount,
      projects[projectId].totalCount
    );
  }
}

function processIssue(
  encryptionKey: string,
  projectId: string,
  index: number,
  totalIssues: number
) {
  const transitionProjectDb = transitionProjectApi(encryptionKey, projectId);
  const issue = transitionProjectDb.get(`issues[${index}]`).value;
  const labels = transitionProjectDb.get('labels').value();
  transitionProjectDb
    .set('labels', unique(labels.concat(issue.labels)))
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

  if (index >= totalIssues) {
    getMigrationQueueDb(encryptionKey)
      .set(`processingProjects.${projectId}.isProcessing`, false)
      .write();
    getMigrationQueueDb(encryptionKey)
      .set(`processingProjects.${projectId}.isLoading`, false)
      .write();
    getMigrationQueueDb(encryptionKey)
      .set(`processingProjects.${projectId}.completedCount`, 0)
      .write();
  }
}

async function loadGitlabProjectIssues(
  encryptionKey: string,
  projectId: string
) {
  const gitlabApi = GitlabApi(encryptionKey);
  getMigrationQueueDb(encryptionKey)
    .set(`processingProjects.${projectId}`, {
      projectId,
      isProcessing: false,
      isLoading: true,
      completedCount: 0,
      totalCount: 0,
      gitlabProjectName: '',
      currentMessage: 'Loading'
    })
    .write();
  const transitionProjectDb = transitionProjectApi(encryptionKey, projectId);
  const projectMeta = await gitlabApi.Projects.show(projectId);
  transitionProjectDb
    .set('meta', mapKeys(projectMeta, (value, key) => camelCase(key)))
    .write();
  const issues = await gitlabApi.Issues.all({
    projectId
  });
  transitionProjectDb.set('issues', issues).write();

  if (!isProcessing) {
    processIssues(encryptionKey);
  }
}
