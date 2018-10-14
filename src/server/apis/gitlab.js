// @flow
import GitlabApi from 'gitlab';
import { getCredential } from './credentials';
import type { GitlabCredential } from './credentials';
import type { DatabaseType } from '../models';

// const appUrl = 'https://gitlab.kkvesper.net';
// const token = '5Nvgz79duhqAB6Pgs-DM';

export default async function gitlabApi(database: DatabaseType) {
  const credential: GitlabCredential = (await getCredential(
    database,
    'gitlab'
  ): any);
  return new GitlabApi({
    url: credential.appUrl,
    token: credential.token
  });
}
