// @flow
import filter from 'lodash/filter';
import { jiraRequest } from '../apis/jira';
import type {
  GitlabMilestoneType,
  TransitionMappingVersionType
} from './types';
import type { DatabaseType } from '../models';

async function createMappingVersion(
  database: DatabaseType,
  map: {
    projectId: string,
    milestoneId: string,
    versionId: string
  }
) {
  return await database.MigrationMappingVersions.upsert(map);
}

async function createVersion(
  database: DatabaseType,
  jiraApi: *,
  jiraProjectId: string,
  gitlabProjectId: string,
  milestone: GitlabMilestoneType
) {
  const jiraVersion = await jiraRequest(jiraApi, 'post', '/version', {
    projectId: jiraProjectId,
    name: milestone.title,
    description: milestone.description,
    released: milestone.state === 'closed',
    startDate: milestone.start_date,
    releaseDate: milestone.due_date
  });
  return createMappingVersion(database, {
    projectId: gitlabProjectId,
    milestoneId: `${milestone.id}`,
    versionId: jiraVersion.id
  });
}

export async function createVersionFromMilestone(
  database: DatabaseType,
  jiraApi: *,
  jiraProjectId: string,
  gitlabProjectId: string,
  milestoneId: string
): boolean {
  const milestone = await database.MigrationMilestones.findOne({
    where: {
      projectId: gitlabProjectId,
      id: milestoneId
    }
  });
  await createVersion(
    database,
    jiraApi,
    jiraProjectId,
    gitlabProjectId,
    // $FlowFixMe
    milestone
  );
  // $FlowFixMe
  return true;
}

export default async function createVersionsFromMilestones(
  database: DatabaseType,
  jiraApi: *,
  jiraProjectId: string,
  gitlabProjectId: string
): TransitionMappingVersionType[] {
  const queryOptions = {
    where: {
      projectId: gitlabProjectId
    }
  };

  // $FlowFixMe
  const versions = await database.MigrationMappingVersions.findAll(
    queryOptions
  );
  const milestones = await database.MigrationMilestones.findAll(queryOptions);
  const milestonesToTransition: GitlabMilestoneType[] = filter(
    milestones,
    ({ id }) => !versions.find((version) => version.milestoneId === id)
  );

  const currentJiraVersions = await jiraRequest(
    jiraApi,
    'get',
    `/project/${jiraProjectId}/versions`
  );

  await Promise.all(
    milestonesToTransition.map((milestone) => {
      try {
        const existingJiraVersion = currentJiraVersions.find(
          ({ name }) => name === milestone.title
        );
        if (existingJiraVersion) {
          return createMappingVersion(database, {
            projectId: gitlabProjectId,
            milestoneId: `${milestone.id}`,
            versionId: existingJiraVersion.id
          });
        } else {
          return createVersion(
            database,
            jiraApi,
            jiraProjectId,
            gitlabProjectId,
            milestone
          );
        }
      } catch (error) {
        console.error(error);
      }
    })
  );

  // $FlowFixMe
  return await database.MigrationMappingVersions.findAll(queryOptions);
}
