import type { TransitionMappingType } from '../transition/types';
import type { DatabaseType } from '../models';

export default function projectMappingApi(
  addon: { schema: { models: DatabaseType } },
  rootResolver: *
) {
  const database = addon.schema.models;
  async function projectMapping(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return await database.MigrationMappings.findOne({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function setProjectMapping(
    root: *,
    {
      gitlabProjectId,
      mapping
    }: {
      gitlabProjectId: string,
      mapping: TransitionMappingType
    }
  ): * {
    await database.MigrationMappings.upsert({
      ...mapping,
      projectId: gitlabProjectId
    });
    return await database.MigrationMappings.findOne({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function projectMappingComponents(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    return await database.MigrationMappingComponents.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function upsertProjectMappingComponent(root: *, { component }: *) {
    await database.MigrationMappingComponents.upsert(component);
    return { success: true };
  }

  async function deleteProjectMappingComponent(
    root: *,
    { id }: { id: number }
  ) {
    const deletedCount = await database.MigrationMappingComponents.destroy({
      where: {
        id
      }
    });
    return { success: deletedCount === 1 };
  }

  async function projectMappingIssueTypes(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    return await database.MigrationMappingIssueTypes.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function upsertProjectMappingIssueType(root: *, { issueType }: *) {
    await database.MigrationMappingIssueTypes.upsert(issueType);
    return { success: true };
  }

  async function deleteProjectMappingIssueType(
    root: *,
    { id }: { id: number }
  ) {
    const deletedCount = await database.MigrationMappingIssueTypes.destroy({
      where: {
        id
      }
    });
    return { success: deletedCount === 1 };
  }

  async function projectMappingPriorities(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    return await database.MigrationMappingPriorities.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function upsertProjectMappingPriority(root: *, { priority }: *) {
    await database.MigrationMappingPriorities.upsert(priority);
    return { success: true };
  }

  async function deleteProjectMappingPriority(root: *, { id }: { id: number }) {
    const deletedCount = await database.MigrationMappingPriorities.destroy({
      where: {
        id
      }
    });
    return { success: deletedCount === 1 };
  }

  async function projectMappingStatuses(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    return await database.MigrationMappingStatuses.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function upsertProjectMappingStatus(root: *, { status }: *) {
    await database.MigrationMappingStatuses.upsert(status);
    return { success: true };
  }

  async function deleteProjectMappingStatus(root: *, { id }: { id: number }) {
    const deletedCount = await database.MigrationMappingStatuses.destroy({
      where: {
        id
      }
    });
    return { success: deletedCount === 1 };
  }

  async function projectMappingVersions(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    return await database.MigrationMappingVersions.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function upsertProjectMappingVersion(root: *, { version }: *) {
    await database.MigrationMappingVersions.upsert(version);
    return { success: true };
  }

  async function deleteProjectMappingVersion(root: *, { id }: { id: number }) {
    const deletedCount = await database.MigrationMappingVersions.destroy({
      where: {
        id
      }
    });
    return { success: deletedCount === 1 };
  }

  return {
    Queries: {
      ...rootResolver.Queries,
      projectMapping,
      projectMappingComponents,
      projectMappingIssueTypes,
      projectMappingPriorities,
      projectMappingStatuses,
      projectMappingVersions
    },
    Mutations: {
      ...rootResolver.Mutations,
      setProjectMapping,
      upsertProjectMappingComponent,
      deleteProjectMappingComponent,
      upsertProjectMappingIssueType,
      deleteProjectMappingIssueType,
      upsertProjectMappingPriority,
      deleteProjectMappingPriority,
      upsertProjectMappingStatus,
      deleteProjectMappingStatus,
      upsertProjectMappingVersion,
      deleteProjectMappingVersion
    }
  };
}
