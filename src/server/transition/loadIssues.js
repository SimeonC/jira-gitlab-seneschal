// @flow
import compact from 'lodash/compact';
import unique from 'lodash/uniq';
import uniqueBy from 'lodash/uniqBy';
import mapKeys from 'lodash/mapKeys';
import camelCase from 'lodash/camelCase';
import transitionProjectApi from '../apis/transitionProject';
import lowdb from '../lowdb';

const queueDb = lowdb('migrationQueue', {
  queue: [],
  failures: [],
  processingProjects: {}
});

export default async function loadGitlabProjectIssues(
  api: *,
  projectId: string
) {
  const transitionProjectDb = transitionProjectApi(projectId);
  const projectMeta = await api.Projects.show(projectId);
  transitionProjectDb
    .set('meta', mapKeys(projectMeta, (value, key) => camelCase(key)))
    .write();
  const issues = await api.Issues.all({
    projectId
  });
  queueDb
    .set(`processingProjects.${projectId}`, {
      projectId,
      isProcessing: false,
      completedCount: 0,
      totalCount: issues.length,
      gitlabProjectName: projectMeta.name_with_namespace,
      currentMessage: 'Pre-Processing'
    })
    .write();
  issues.forEach((issue) => {
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
  });

  return {
    issues: transitionProjectDb.get('issues').value(),
    labels: transitionProjectDb.get('labels').value(),
    milestones: transitionProjectDb.get('milestones').value(),
    users: transitionProjectDb.get('users').value()
  };
}
