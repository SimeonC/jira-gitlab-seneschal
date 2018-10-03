// @flow
import GitlabApi from 'gitlab';
import { getCredential } from './credentials';
import type { GitlabCredential } from './credentials';

// const appUrl = 'https://gitlab.kkvesper.net';
// const token = '5Nvgz79duhqAB6Pgs-DM';

export default function gitlabApi(encryptionKey: string) {
  const credential: GitlabCredential = (getCredential(
    encryptionKey,
    'gitlab'
  ): any);
  return new GitlabApi({
    url: credential.appUrl,
    token: credential.token
  });
}
