// @flow
import path from 'path';
import fs from 'fs-extra';
import lowdb from '../lowdb';

const defaults = {
  isProcessing: false,
  meta: {},
  issues: [],
  labels: [],
  milestones: [],
  users: [],
  mapping: {
    baseValues: {
      project: null
    },
    defaultIssueTypeId: '',
    defaultIssueTypeClosedStatusId: '',
    defaultResolutionId: '',
    issueTypes: [],
    statuses: [],
    versions: [],
    components: [],
    priorities: []
  }
};

export function deleteTransitionProjectApi(projectId: string) {
  const filePath = path.join(__dirname, `../lowdb/${projectId}.json`);
  fs.removeSync(filePath);
}

export default function transitionProjectApi(
  encryptionKey: string,
  projectId: string,
  force?: boolean = false
) {
  const transitionProjectApiDb = lowdb(
    encryptionKey,
    `project-${projectId}`,
    defaults
  );

  // if not processing it is editable
  if (force || !transitionProjectApiDb.get('isProcessing').value())
    return transitionProjectApiDb;

  return lowdb(encryptionKey, `project-${projectId}`, undefined, {
    serialize: () => {
      throw new Error('Cannot edit transition project that is being processed');
    },
    deserialize: (data) => JSON.parse(data)
  });
}
