// @flow
import type { DatabaseType } from '../models';

export type GitlabCredential = {
  appUrl: string,
  token: string
};

export type JiraCredential = {
  token: string
};

export async function setCredential(
  database: DatabaseType,
  key: 'gitlab' | string,
  credential: GitlabCredential | JiraCredential
) {
  await database.Credentials.upsert({
    key,
    ...credential
  });
}

export async function getCredential(
  database: DatabaseType,
  key: 'gitlab' | string
): ?GitlabCredential | ?JiraCredential {
  // $FlowFixMe
  return await database.Credentials.findOne({
    where: {
      key
    }
  });
}

export async function clearCredential(
  database: DatabaseType,
  key: 'gitlab' | string
) {
  return await database.Credentials.destroy({
    where: {
      key
    }
  });
}
