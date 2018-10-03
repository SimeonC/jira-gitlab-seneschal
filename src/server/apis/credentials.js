// @flow
import lowdb from '../lowdb';

export type GitlabCredential = {
  appUrl: string,
  token: string
};

export type JiraCredential = {
  clientKey: string
};

function loadDb(encryptionKey: string) {
  return lowdb('credentials', { jira: {}, gitlab: {} }, encryptionKey);
}

export function setCredential(
  encryptionKey: string,
  key: 'gitlab' | string,
  credential: GitlabCredential | JiraCredential
) {
  loadDb(encryptionKey)
    .set(key, credential)
    .write();
}

export function getCredential(
  encryptionKey: string,
  key: 'gitlab' | string
): GitlabCredential | JiraCredential {
  return loadDb(encryptionKey)
    .get(key)
    .value();
}
