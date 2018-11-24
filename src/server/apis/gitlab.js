// @flow
import GitlabApi from 'gitlab';
import { getCredential } from './credentials';
import type { GitlabCredential } from './credentials';
import type { DatabaseType } from '../models';

export default async function gitlabApi(database: DatabaseType, jiraAddon: *) {
  const credential: GitlabCredential = (await getCredential(
    database,
    // $FlowFixMe
    jiraAddon.config.CREDENTIAL_ENCRYPTION_KEY(),
    'gitlab'
  ): any);
  return new GitlabApi({
    url: credential.appUrl,
    token: credential.token
  });
}
