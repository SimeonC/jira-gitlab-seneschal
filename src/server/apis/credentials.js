// @flow
import type { DatabaseType } from '../models';
import { encrypt, decrypt } from '../utils/encryption';

export type GitlabCredential = {
  appUrl: string,
  token: string
};

export type JiraCredential = {
  token: string
};

export function encryptKeys(
  encryptionKey: string,
  credential: { [string]: string }
) {
  ['token', 'appUrl'].forEach((key) => {
    if (credential[key]) {
      credential[key] = encrypt(credential[key], encryptionKey);
    }
  });
  return credential;
}

export function decryptKeys(
  encryptionKey: string,
  credential: { [string]: string }
): ?GitlabCredential | ?JiraCredential {
  if (!credential) return credential;
  ['token', 'appUrl'].forEach((key) => {
    if (credential[key]) {
      credential[key] = decrypt(credential[key], encryptionKey);
    }
  });
  return credential;
}

export async function setCredential(
  database: DatabaseType,
  encryptionKey: string,
  key: 'gitlab' | string,
  credential: GitlabCredential | JiraCredential
) {
  await database.Credentials.upsert({
    key,
    ...encryptKeys(encryptionKey, credential)
  });
}

export async function getCredential(
  database: DatabaseType,
  encryptionKey: string,
  key: 'gitlab' | string
): ?GitlabCredential | ?JiraCredential {
  // $FlowFixMe
  const credential = await database.Credentials.findOne({
    where: {
      key
    }
  });
  // $FlowFixMe
  return decryptKeys(encryptionKey, credential);
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
