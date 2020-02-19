// @flow
import { Gitlab } from 'gitlab';
import { getCredential } from './credentials';
import type { GitlabCredential } from './credentials';

export default async function gitlabApi(jiraAddon: *) {
  const credential: GitlabCredential = (await getCredential(
    jiraAddon,
    'gitlab'
  ): any);
  return new Gitlab({
    host: credential.appUrl,
    token: credential.token
  });
}
