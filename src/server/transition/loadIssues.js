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
  loadGitlabProjectIssues(message.encryptionKey, message.projectId);
});

function getMigrationQueueDb(encryptionKey: string) {
  return lowdb(
    'migrationQueue',
    {
      queue: [],
      failures: [],
      processingProjects: {}
    },
    encryptionKey
  );
}

// This is done as recursive to allow it to be non-blocking in the thread
async function processIssue(
  encryptionKey: string,
  projectMeta: *,
  projectId: string,
  issues: *[],
  index: number
) {
  const migrationQueueDb = getMigrationQueueDb(encryptionKey);
  const transitionProjectDb = transitionProjectApi(encryptionKey, projectId);
  const issue = issues[index];
  const currentIssues = transitionProjectDb.get('issues');
  if (!currentIssues.find({ id: issue.id }).value()) {
    currentIssues.push(issue).write();
  }
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
  migrationQueueDb
    .set(`processingProjects.${projectId}`, {
      projectId,
      isProcessing: false,
      isLoading: true,
      completedCount: index,
      totalCount: issues.length,
      gitlabProjectName: projectMeta.name_with_namespace,
      currentMessage: 'Pre-Processing'
    })
    .write();

  if (index < issues.length - 1) {
    return processIssue(
      encryptionKey,
      projectMeta,
      projectId,
      issues,
      index + 1
    );
  }

  migrationQueueDb
    .set(`processingProjects.${projectId}`, {
      projectId,
      isProcessing: false,
      isLoading: false,
      completedCount: 0,
      totalCount: issues.length,
      gitlabProjectName: projectMeta.name_with_namespace,
      currentMessage: 'Pre-Processing'
    })
    .write();
}

async function loadGitlabProjectIssues(
  encryptionKey: string,
  projectId: string
) {
  const gitlabApi = GitlabApi(encryptionKey);
  const migrationQueueDb = getMigrationQueueDb(encryptionKey);
  migrationQueueDb
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
  migrationQueueDb
    .set(`processingProjects.${projectId}`, {
      projectId,
      isProcessing: false,
      isLoading: true,
      completedCount: 0,
      totalCount: issues.length,
      gitlabProjectName: projectMeta.name_with_namespace,
      currentMessage: 'Pre-Processing'
    })
    .write();
  processIssue(encryptionKey, projectMeta, projectId, issues, 0);
}
