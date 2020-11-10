// @flow
import { Gitlab } from '@gitbeaker/node';
import uniqBy from 'lodash/uniqBy';
import { getCredential } from './credentials';
import type { GitlabCredential } from './credentials';

async function gitlabApi(jiraAddon: *, clientKey: string) {
  const credential: GitlabCredential = (await getCredential(
    jiraAddon,
    `${clientKey}_gitlab`
  ): any);
  if (!credential)
    throw new Error(`${clientKey} has not been setup with gitlab credentials`);
  return new Gitlab({
    host: credential.appUrl,
    token: credential.token
  });
}

export async function getAllProjects(jiraAddon: *, clientKey: string) {
  const api = await gitlabApi(jiraAddon, clientKey);
  const allProjects = await api.Projects.all({
    archived: false,
    membership: true,
    simple: true,
    min_access_level: 40 // at least maintainer
  });
  const ownedProjects = await api.Projects.all({
    archived: false,
    membership: true,
    simple: true,
    owned: true
  });
  return uniqBy(ownedProjects.concat(allProjects), 'id');
}

export default gitlabApi;
