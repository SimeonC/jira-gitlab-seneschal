// @flow
import axios from 'axios';
import type { DatabaseType } from '../models';
import { encrypt, decrypt } from '../utils/encryption';

export type GitlabCredential = {
  appUrl: string,
  token: string
};

export type JiraCredential = {
  // here the appUrl is used as the Key for the OAuth 2 credentials
  appUrl: string,
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

export async function setDevToolsCredential(
  jiraApp: *,
  clientKey: string,
  credential: {
    clientId: string,
    clientToken: string
  }
) {
  await jiraApp.schema.models.Credentials.upsert({
    key: `dev-tools-${clientKey}`,
    ...encryptKeys(jiraApp.config.CREDENTIAL_ENCRYPTION_KEY(), {
      token: credential.clientToken,
      appUrl: credential.clientId
    })
  });
}

export async function getCredential(
  jiraApp: *,
  key: string
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

export async function getDevToolsToken(jiraApp: *, clientKey: string): string {
  // $FlowFixMe
  const credentialRecord = await jiraApp.schema.models.Credentials.findOne({
    where: {
      key: `dev-tools-${clientKey}`
    }
  });
  const credential = decryptKeys(
    jiraApp.config.CREDENTIAL_ENCRYPTION_KEY(),
    credentialRecord
  );
  // $FlowFixMe
  if (!credential) return null;
  const response = await axios.post('https://api.atlassian.com/oauth/token', {
    audience: 'api.atlassian.com',
    grant_type: 'client_credentials',
    client_id: credential.appUrl,
    client_secret: credential.token
  });
  // $FlowFixMe
  return `${response.data.token_type} ${response.data.access_token}`;
}

export async function clearCredential(jiraApp: *, key: 'gitlab' | string) {
  return await jiraApp.schema.models.Credentials.destroy({
    where: {
      key
    }
  });
}

export async function clearDevToolCredential(jiraApp: *, clientKey: string) {
  return await clearCredential(jiraApp, `dev-tools-${clientKey}`);
}
