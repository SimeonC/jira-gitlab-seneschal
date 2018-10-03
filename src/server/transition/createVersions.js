// @flow
import filter from 'lodash/filter';
import { jiraRequest } from '../apis/jira';
import type {
  GitlabMilestoneType,
  TransitionMappingType,
  TransitionMappingVersionType
} from './types';
import transitionProjectApi from '../apis/transitionProject';

async function createVersion(
  jiraApi: *,
  jiraProjectId: string,
  gitlabProjectId: string,
  milestone: GitlabMilestoneType
): TransitionMappingVersionType {
  const jiraVersion = await jiraRequest(jiraApi, 'post', '/version', {
    projectId: jiraProjectId,
    name: milestone.title,
    description: milestone.description,
    released: milestone.state === 'closed',
    startDate: milestone.start_date,
    releaseDate: milestone.due_date
  });
  // $FlowFixMe Async Promise/Object type conflict
  return {
    milestoneId: milestone.id,
    versionId: jiraVersion.id
  };
}

export async function createVersionFromMilestone(
  encryptionKey: string,
  jiraApi: *,
  jiraProjectId: string,
  gitlabProjectId: string,
  milestoneId: string
): boolean {
  const transitionProjectDb = transitionProjectApi(
    encryptionKey,
    gitlabProjectId
  );
  const milestone = transitionProjectDb
    .get('milestones')
    .find({ id: milestoneId })
    .value();
  const newVersion = await createVersion(
    jiraApi,
    jiraProjectId,
    gitlabProjectId,
    milestone
  );
  transitionProjectDb
    .get('mapping.versions')
    .push(newVersion)
    .write();
  // $FlowFixMe Async Promise/Object type conflict
  return true;
}

export default async function createVersionsFromMilestones(
  encryptionKey: string,
  jiraApi: *,
  jiraProjectId: string,
  gitlabProjectId: string
): TransitionMappingType {
  const transitionProjectDb = transitionProjectApi(
    encryptionKey,
    gitlabProjectId
  );

  const mapping: TransitionMappingType = transitionProjectDb
    .get('mapping')
    .value();
  const milestonesToTransition: GitlabMilestoneType[] = filter(
    transitionProjectDb.get('milestones').value(),
    ({ id }) => !mapping.versions.find((version) => version.milestoneId === id)
  );

  const currentJiraVersions = await jiraRequest(
    jiraApi,
    'get',
    `/project/${jiraProjectId}/versions`
  );

  const newVersions = await Promise.all(
    milestonesToTransition.map(async (milestone) => {
      try {
        const existingJiraVersion = currentJiraVersions.find(
          ({ name }) => name === milestone.title
        );
        if (existingJiraVersion) {
          return {
            milestoneId: milestone.id,
            versionId: existingJiraVersion.id
          };
        }
        return createVersion(
          jiraApi,
          jiraProjectId,
          gitlabProjectId,
          milestone
        );
      } catch (error) {
        console.error(error);
      }
    })
  );

  transitionProjectDb
    .get('mapping.versions')
    .push(...newVersions)
    .write();

  // $FlowFixMe Async Promise/Object type conflict
  return transitionProjectDb.get('mapping').value();
}
