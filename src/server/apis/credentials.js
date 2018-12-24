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
  jiraApp: *,
  key: 'gitlab' | string,
  credential: GitlabCredential | JiraCredential
) {
  await jiraApp.schema.models.Credentials.upsert({
    key,
    ...encryptKeys(jiraApp.config.CREDENTIAL_ENCRYPTION_KEY(), credential)
  });
}

export async function getCredential(
  jiraApp: *,
  key: 'gitlab' | string
): ?GitlabCredential | ?JiraCredential {
  // $FlowFixMe
  const credential = await jiraApp.schema.models.Credentials.findOne({
    where: {
      key
    }
  });
  // $FlowFixMe
  return decryptKeys(jiraApp.config.CREDENTIAL_ENCRYPTION_KEY(), credential);
}

export async function clearCredential(jiraApp: *, key: 'gitlab' | string) {
  return await jiraApp.schema.models.Credentials.destroy({
    where: {
      key
    }
  });
}
