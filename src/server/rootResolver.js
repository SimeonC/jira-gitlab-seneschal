// @flow
import mapKeys from 'lodash/mapKeys';
import camelCase from 'lodash/camelCase';
import path from 'path';
import { fork } from 'child_process';
import gitlabApi, {
  getAllProjects as getAllGitlabProjects
} from './apis/gitlab';
import { jiraRequest } from './apis/jira';
import {
  getCredential,
  getDevToolsToken,
  setCredential,
  setDevToolsCredential
} from './apis/credentials';
import {
  allProjects,
  getWebhookErrors,
  retryWebhookFailure,
  getWebhookMetadata as coreGetWebhookMetadata,
  deleteWebhookFailure as internalDeleteWebhookFailure,
  deleteAllWebhookFailures as internaldeleteAllWebhookFailures
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
  WebhookTransitionMapsType,
  WebhookTransitionMapType
} from './apis/webhooks.types';
import projectMappingApi from './apis/projectMapping';
import { createWebhooks } from './webhooks';
import type { DatabaseType } from './models';
import type { GitlabCredential } from './apis/credentials';
import initWebhookSettings from './webhooks/settings';

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

async function testGitlabCredentials(
  database: DatabaseType,
  jiraAddon: *,
  clientKey
) {
  try {
    const api = await gitlabApi(jiraAddon, clientKey);
    await api.Users.current();
    return true;
  } catch (err) {
    console.error('gitlab', err);
    return false;
  }
}

export default function (addon: *) {
  const database = addon.schema.models;
  loadGitlabProjectProcess.send({
    init: true,
    ...addon.config.store()
  });

  async function isSetup(root: *, params: *, req: *) {
    let currentUrl;
    let success = false;
    let username;
    try {
      const api = await gitlabApi(addon, req.context.clientKey);
      ({ username } = await api.Users.current());
      const credential: GitlabCredential = (await getCredential(
        addon,
        `${req.context.clientKey}_gitlab`
      ): any);
      currentUrl = credential.appUrl;
      success = true;
    } catch (e) {}
    return {
      success,
      username,
      currentUrl
    };
  }

  async function devToolsStatus(root: *, params: *, req: *) {
    try {
      const bearer = await getDevToolsToken(addon, req.context.clientKey);
      return { status: bearer ? 'connected' : 'disconnected' };
    } catch (e) {}
    return { status: 'disconnected' };
  }

  async function setDevToolsCredentials(
    root: *,
    { clientId, clientToken }: { clientId: string, clientToken: string },
    req: *
  ) {
    try {
      await setDevToolsCredential(addon, req.context.clientKey, {
        clientId,
        clientToken
      });
    } catch (error) {
      console.error(error);
    }
    return await devToolsStatus(root, {}, req);
  }

  async function appSettings(root: *, params: *, req: *) {
    const keys = await new Promise((resolve, reject) => {
      addon.httpClient(req).get(
        {
          uri: `/rest/atlassian-connect/1/addons/gitlab-seneschal-link/properties`
        },
        (err, res, body) => {
          if (err) reject(err);
          else {
            try {
              const { keys } = JSON.parse(body);
              resolve(keys);
            } catch (err) {
              reject();
            }
          }
        }
      );
    });
    const values = await Promise.all(
      keys.map(
        ({ key, self }) =>
          new Promise((resolve, reject) => {
            addon.httpClient(req).get(
              {
                uri: self
              },
              (err, res, body) => {
                if (err) reject(err);
                else {
                  try {
                    resolve(JSON.parse(body));
                  } catch (err) {
                    reject();
                  }
                }
              }
            );
          })
      )
    );
    return values.reduce(
      (result, { key, value }) => ({ ...result, [key]: value }),
      {}
    );
  }

  const validKeys = ['useGlances'];
  async function setAppSetting(
    root: *,
    params: { key: string, value: string },
    req: *
  ) {
    if (validKeys.indexOf(params.key) === -1)
      throw new Error(
        `Please pass a valid key out of; ${validKeys.join(', ')}`
      );
    return await new Promise((resolve, reject) => {
      addon.httpClient(req).put(
        {
          uri: `/rest/atlassian-connect/1/addons/gitlab-seneschal-link/properties/${params.key}`,
          body: params.value,
          json: true
        },
        (err, res, body) => {
          if (err) reject(err);
          else {
            resolve({ success: true });
          }
        }
      );
    });
  }

  async function jiraProjects(
    root: *,
    { jiraProjectId }: { jiraProjectId?: string },
    req: *
  ) {
    let projectsRequest;
    if (jiraProjectId) {
      const projectRequest = await jiraRequest(
        addon.httpClient(req),
        'get',
        `/project/${jiraProjectId}`
      );
      projectsRequest = [projectRequest];
    } else {
      projectsRequest = await jiraRequest(
        addon.httpClient(req),
        'get',
        '/project'
      );
    }
    return projectsRequest.map((project) => {
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

  async function gitlabProjects(root: *, params: *, req: *) {
    const projects = await getAllGitlabProjects(addon, req.context.clientKey);
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
    { projectId }: { projectId: string },
    req: *
  ) {
    loadGitlabProjectProcess.send({
      projectId,
      clientKey: req.context.clientKey
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
    { appUrl, token }: { appUrl: string, token: string },
    req: *
  ) {
    try {
      await setCredential(addon, `${req.context.clientKey}_gitlab`, {
        appUrl,
        token
      });
      return {
        success: testGitlabCredentials(
          addon.schema.models,
          addon,
          req.context.clientKey
        )
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

  async function setDefaultWebhookTransition(
    root: *,
    {
      openStatusIds = [],
      closeStatusIds = [],
      mergeStatusIds = []
    }: WebhookTransitionMapType,
    req: *
  ): SuccessResponseType {
    await addon.schema.models.WebhookDefaultTransitionMaps.upsert({
      clientKey: req.context.clientKey,
      openStatusIds,
      closeStatusIds,
      mergeStatusIds
    });
    return { success: true };
  }

  async function upsertWebhookTransitionMap(
    root: *,
    {
      jiraProjectId,
      jiraProjectKey,
      openStatusIds = [],
      closeStatusIds = [],
      mergeStatusIds = []
    }: WebhookTransitionMapsType,
    req: *
  ): SuccessResponseType {
    await addon.schema.models.WebhookTransitionMaps.upsert({
      clientKey: req.context.clientKey,
      jiraProjectId,
      jiraProjectKey,
      openStatusIds,
      closeStatusIds,
      mergeStatusIds
    });
    return { success: true };
  }

  async function deleteWebhookTransitionMap(
    root: *,
    { jiraProjectId }: { jiraProjectId: string },
    req: *
  ): SuccessResponseType {
    const deletedCount = await addon.schema.models.WebhookTransitionMaps.destroy(
      {
        where: {
          clientKey: req.context.clientKey,
          jiraProjectId
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
    return createWebhooks(addon, gitlabProjectId, req.context.clientKey);
  }

  async function getProjectWebhookTransitionMap(
    root: *,
    { jiraProjectId }: { jiraProjectId: string },
    req: *
  ): WebhookTransitionMapType {
    const result = await addon.schema.models.WebhookTransitionMaps.findOne({
      where: {
        jiraProjectId,
        clientKey: req.context.clientKey
      }
    });
    if (!result) {
      return {
        jiraProjectId,
        jiraProjectKey: '',
        mergeStatusIds: [],
        openStatusIds: [],
        closeStatusIds: []
      };
    }
    return result;
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
    return {
      page: pageOffset + 1,
      totalPages: Math.ceil(count / pageSize),
      rows: rows.map(({ id, original, error, createdAt }) => {
        original.secretKey = 'OMITTED';
        return {
          id,
          original: JSON.stringify(original),
          error: JSON.stringify(error),
          createdAt
        };
      })
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

  async function deleteWebhookFailure(
    root: *,
    { id }: { id: string }
  ): SuccessResponseType {
    return {
      success: await internalDeleteWebhookFailure(addon.schema.models, id)
    };
  }

  async function deleteAllWebhookFailures(): SuccessResponseType {
    return {
      success: await internaldeleteAllWebhookFailures(addon.schema.models)
    };
  }

  const {
    getWebhookSettings,
    setWebhookSetting,
    deleteWebhookSetting
  } = initWebhookSettings(addon);

  // bind all these functions to pass in the addon/jira api
  return projectMappingApi(addon, {
    Queries: {
      isSetup,
      devToolsStatus,
      appSettings,
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
      getProjectWebhookTransitionMap,
      webhooks,
      webhookErrors,
      getWebhookSettings
    },
    Mutations: {
      setAppSetting,
      setGitlabCredentials,
      setDevToolsCredentials,
      loadGitlabProject,
      setWebhookMetadata,
      setDefaultWebhookTransition,
      upsertWebhookTransitionMap,
      deleteWebhookTransitionMap,
      createGitlabWebhooks,
      processProject,
      createJiraVersionFromMilestone,
      clearMigrationProject,
      migrateMilestones,
      retryAllFailures,
      retryWebhook,
      deleteWebhookFailure,
      deleteAllWebhookFailures,
      setWebhookSetting,
      setProjectWebhookSetting: setWebhookSetting,
      deleteWebhookSetting
    }
  });
}
