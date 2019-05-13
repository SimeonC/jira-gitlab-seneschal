// @flow
import mapKeys from 'lodash/mapKeys';
import camelCase from 'lodash/camelCase';
import path from 'path';
import { fork } from 'child_process';
import gitlabApi from './apis/gitlab';
import { jiraRequest } from './apis/jira';
import { setCredential } from './apis/credentials';
import {
  allProjects,
  getWebhookErrors,
  retryWebhookFailure,
  getWebhookMetadata as coreGetWebhookMetadata
} from './apis/webhooks';
import type { TransitionMappingVersionType } from './transition/types';
import {
  projectStatuses,
  projectStatus,
  reprocessAllFailures,
  clearProject,
  startProcessingProject,
  projectFailures
} from './transition/migrationQueue';
import createVersionsFromMilestones, {
  createVersionFromMilestone
} from './transition/createVersions';
import type {
  WebhookErrorType,
  WebhookMetadataType,
  WebhookProjectStatusType,
  WebhookTransitionMapsType
} from './apis/webhooks.types';
import projectMappingApi from './apis/projectMapping';
import { createWebhooks } from './webhooks';
import type { DatabaseType } from './models';

type SuccessResponseType = {
  success: boolean
};

const loadGitlabProjectProcess = fork(
  path.join(__dirname, './transition/loadIssues')
);

// Debug Code - console.log breaks in forked process
loadGitlabProjectProcess.on('message', (message) => {
  console.log('[ProjectProcess]', message);
});

const cleanExit = (signal) => {
  loadGitlabProjectProcess.kill(signal);
  process.exit();
};
process.on('SIGINT', () => cleanExit('SIGINT')); // catch ctrl-c
process.on('SIGUSR2', () => cleanExit('SIGUSR2')); // catch ctrl-c
process.on('SIGTERM', () => cleanExit('SIGTERM')); // catch kill

async function testGitlabCredentials(database: DatabaseType, jiraAddon: *) {
  try {
    const api = await gitlabApi(jiraAddon);
    await api.Users.current();
    return true;
  } catch (err) {
    console.error('gitlab', err);
    return false;
  }
}

export default function(addon: *) {
  const database = addon.schema.models;
  loadGitlabProjectProcess.send({
    init: true,
    ...addon.config.store()
  });

  async function isSetup() {
    return {
      success: await testGitlabCredentials(database, addon)
    };
  }

  async function jiraProjects(root: *, params: *, req: *) {
    const projectRequest = await jiraRequest(
      addon.httpClient(req),
      'get',
      '/project'
    );
    return projectRequest.map((project) => {
      project.avatarUrls = {
        __typename: 'JiraAvatarUrls',
        size48: project.avatarUrls['48x48'],
        size24: project.avatarUrls['24x24'],
        size16: project.avatarUrls['16x16'],
        size32: project.avatarUrls['32x32']
      };
      return project;
    });
  }

  async function jiraIssueTypes(
    root: *,
    { projectId }: { projectId: string },
    req: *
  ) {
    const statuses = await jiraRequest(
      addon.httpClient(req),
      'get',
      `/project/${projectId}/statuses`
    );
    const issueTypes = await jiraRequest(
      addon.httpClient(req),
      'get',
      `/issuetype`
    );
    return statuses.map((issueType) => {
      const matchingIssueType = issueTypes.find(
        ({ id }) => id === issueType.id
      );
      return {
        ...issueType,
        iconUrl: matchingIssueType.iconUrl
      };
    });
  }

  async function jiraVersions(
    root: *,
    { projectId }: { projectId: string },
    req: *
  ) {
    return await jiraRequest(
      addon.httpClient(req),
      'get',
      `/project/${projectId}/versions`
    );
  }

  async function jiraPriorities(root: *, params: *, req: *) {
    return await jiraRequest(addon.httpClient(req), 'get', `/priority`);
  }

  async function jiraResolutions(root: *, params: *, req: *) {
    return await jiraRequest(addon.httpClient(req), 'get', `/resolution`);
  }

  async function jiraComponents(
    root: *,
    { projectId }: { projectId: string },
    req: *
  ) {
    return await jiraRequest(
      addon.httpClient(req),
      'get',
      `/project/${projectId}/components`
    );
  }

  async function jiraStatuses(root: *, params: *, req: *) {
    return await jiraRequest(addon.httpClient(req), 'get', '/status');
  }

  async function gitlabProjects() {
    const api = await gitlabApi(addon);
    const projects = await api.Projects.all({
      archived: false,
      simple: true
    });
    return projects.map((project) =>
      mapKeys(project, (value, key) => camelCase(key))
    );
  }

  async function clearMigrationProject(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    // pass addon as needs transaction
    await clearProject(addon, gitlabProjectId);
    return {
      success: true
    };
  }

  async function loadGitlabProject(
    root: *,
    { projectId }: { projectId: string }
  ) {
    loadGitlabProjectProcess.send({
      projectId
    });
    return {
      success: true
    };
  }

  function processingFailures() {
    return projectFailures(addon.schema.models);
  }

  function processingProjects() {
    return projectStatuses(addon.schema.models);
  }

  function processingProject(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    return projectStatus(addon.schema.models, gitlabProjectId);
  }

  async function projectLabels(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    const labels = await addon.schema.models.MigrationLabels.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
    return labels.map(({ label }) => label);
  }

  async function projectUsers(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return await addon.schema.models.MigrationUsers.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function projectMilestones(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return await addon.schema.models.MigrationMilestones.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function projectIssues(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return await addon.schema.models.MigrationIssues.findAll({
      where: {
        projectId: gitlabProjectId
      }
    });
  }

  async function projectMeta(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    const project = await addon.schema.models.MigrationProjects.findOne({
      where: {
        projectId: gitlabProjectId
      }
    });
    return project ? project.meta : null;
  }

  async function migrateMilestones(
    root: *,
    {
      gitlabProjectId,
      jiraProjectId
    }: { gitlabProjectId: string, jiraProjectId: string },
    req: *
  ): TransitionMappingVersionType[] {
    return await createVersionsFromMilestones(
      addon.schema.models,
      addon.httpClient(req),
      jiraProjectId,
      gitlabProjectId
    );
  }

  async function createJiraVersionFromMilestone(
    root: *,
    {
      jiraProjectId,
      gitlabProjectId,
      milestoneId
    }: { jiraProjectId: string, gitlabProjectId: string, milestoneId: string },
    req: *
  ): SuccessResponseType {
    // $FlowFixMe
    return {
      success: await createVersionFromMilestone(
        addon.schema.models,
        addon.httpClient(req),
        jiraProjectId,
        gitlabProjectId,
        milestoneId
      )
    };
  }

  async function setGitlabCredentials(
    root: *,
    { appUrl, token }: { appUrl: string, token: string }
  ) {
    try {
      await setCredential(addon, 'gitlab', { appUrl, token });
      return {
        success: testGitlabCredentials(addon.schema.models)
      };
    } catch (error) {
      console.error(error);
      return {
        success: false
      };
    }
  }

  async function processProject(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string },
    req: *
  ): SuccessResponseType {
    await startProcessingProject(
      addon,
      addon.httpClient(req),
      req.context.clientKey,
      gitlabProjectId
    );
    return {
      success: true
    };
  }

  async function retryAllFailures(): SuccessResponseType {
    await reprocessAllFailures(addon);
    return { success: true };
  }

  function getWebhookMetadata(root: *, params: *, req: *): WebhookMetadataType {
    return coreGetWebhookMetadata(
      addon.schema.models,
      req.context.clientKey,
      true
    );
  }

  async function setWebhookMetadata(
    root: *,
    { transitionKeywords }: { transitionKeywords: string[] },
    req: *
  ): SuccessResponseType {
    await addon.schema.models.WebhookTransitions.upsert({
      clientKey: req.context.clientKey,
      transitionKeywords
    });
    return { success: true };
  }

  async function upsertWebhookTransitionMap(
    root: *,
    {
      jiraProjectKey,
      openStatusIds = [],
      closeStatusIds = [],
      mergeStatusIds = []
    }: WebhookTransitionMapsType,
    req: *
  ): SuccessResponseType {
    await addon.schema.models.WebhookTransitionMaps.upsert({
      clientKey: req.context.clientKey,
      jiraProjectKey,
      openStatusIds,
      closeStatusIds,
      mergeStatusIds
    });
    return { success: true };
  }

  async function deleteWebhookTransitionMap(
    root: *,
    { jiraProjectKey }: { jiraProjectKey: string },
    req: *
  ): SuccessResponseType {
    const deletedCount = await addon.schema.models.WebhookTransitionMaps.destroy(
      {
        where: {
          clientKey: req.context.clientKey,
          jiraProjectKey
        }
      }
    );
    return { success: deletedCount === 1 };
  }

  function createGitlabWebhooks(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string },
    req: *
  ): WebhookProjectStatusType {
    return createWebhooks(
      addon,
      gitlabProjectId,
      req.protocol + '://' + req.get('host'),
      req.context.clientKey
    );
  }

  async function webhooks(): WebhookProjectStatusType[] {
    return await allProjects(addon.schema.models);
  }

  async function webhookErrors(
    root: *,
    variables: { pageOffset?: number, pageSize?: number }
  ): WebhookErrorType[] {
    const { pageOffset, pageSize = 20 } = variables;
    const { count, rows } = await getWebhookErrors(
      addon.schema.models,
      pageSize,
      pageOffset
    );
    console.log('[debug]', { variables, count });
    return {
      page: pageOffset + 1,
      totalPages: Math.ceil(count / pageSize),
      rows: rows.map(({ id, original, error, createdAt }) => ({
        id,
        original: JSON.stringify(original),
        error: JSON.stringify(error),
        createdAt
      }))
    };
  }

  async function retryWebhook(
    root: *,
    { id }: { id: string }
  ): SuccessResponseType {
    return {
      success: await retryWebhookFailure(addon, id)
    };
  }

  // bind all these functions to pass in the addon/jira api
  return projectMappingApi(addon, {
    Queries: {
      isSetup,
      jiraProjects,
      gitlabProjects,
      processingFailures,
      processingProjects,
      processingProject,
      projectIssues,
      projectMeta,
      projectLabels,
      projectMilestones,
      projectUsers,
      jiraIssueTypes,
      jiraVersions,
      jiraPriorities,
      jiraResolutions,
      jiraComponents,
      jiraStatuses,
      getWebhookMetadata,
      webhooks,
      webhookErrors
    },
    Mutations: {
      setGitlabCredentials,
      loadGitlabProject,
      setWebhookMetadata,
      upsertWebhookTransitionMap,
      deleteWebhookTransitionMap,
      createGitlabWebhooks,
      processProject,
      createJiraVersionFromMilestone,
      clearMigrationProject,
      migrateMilestones,
      retryAllFailures,
      retryWebhook
    }
  });
}
