// @flow
import lowdb from '../lowdb/encrypted';

export type GitlabCredential = {
  appUrl: string,
  token: string
};

export type JiraCredential = {
  clientKey: string
};

function loadDb(password: string) {
  return lowdb('credentials', { jira: {}, gitlab: {} }, password);
}

export function setCredential(
  password: string,
  key: 'gitlab' | string,
  credential: GitlabCredential | JiraCredential
) {
  loadDb(password)
    .set(key, credential)
    .write();
}

export function getCredential(
  password: string,
  key: 'gitlab' | string
): GitlabCredential | JiraCredential {
  return loadDb(password)
    .get(key)
    .value();
}
