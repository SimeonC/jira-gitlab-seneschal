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
  getWebhookMetadata as coreGetWebhookMetadata,
  setWebhookMetadata as coreSetWebhookMetadata
} from './apis/webhooks';
import type { TransitionMappingType } from './transition/types';
import transitionProjectApi from './apis/transitionProject';
import {
  processQueue,
  projectStatuses,
  projectStatus,
  reprocessAllFailures,
  reprocessFailure,
  startProcessingProject,
  projectFailures
} from './transition/migrationQueue';
import createVersionsFromMilestones, {
  createVersionFromMilestone
} from './transition/createVersions';
import type {
  WebhookMetadataType,
  WebhookProjectStatusType
} from './apis/webhooks';
import { createWebhooks } from './webhooks';

type SuccessResponseType = {
  success: boolean
};

const loadGitlabProjectProcess = fork(
  path.join(__dirname, './transition/loadIssues')
);

const cleanExit = (signal) => {
  loadGitlabProjectProcess.kill(signal);
  process.exit();
};
process.on('SIGINT', () => cleanExit('SIGINT')); // catch ctrl-c
process.on('SIGUSR2', () => cleanExit('SIGUSR2')); // catch ctrl-c
process.on('SIGTERM', () => cleanExit('SIGTERM')); // catch kill

async function testGitlabCredentials(encryptionKey: string) {
  try {
    await gitlabApi(encryptionKey).Users.current();
    return true;
  } catch (err) {
    return false;
  }
}

export default function(encryptionKey: string, addon: *) {
  async function isSetup() {
    return {
      success: await testGitlabCredentials(encryptionKey)
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
    const projects = await gitlabApi(encryptionKey).Projects.all({
      membership: true,
      archived: false,
      simple: true
    });
    return projects.map((project) =>
      mapKeys(project, (value, key) => camelCase(key))
    );
  }

  async function loadGitlabProject(
    root: *,
    { projectId }: { projectId: string }
  ) {
    loadGitlabProjectProcess.send({
      encryptionKey,
      projectId
    });
    return {
      success: true
    };
  }

  function processingFailures() {
    return projectFailures(encryptionKey);
  }

  function processingProjects() {
    return projectStatuses(encryptionKey);
  }

  function processingProject(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ) {
    return projectStatus(encryptionKey, gitlabProjectId);
  }

  function setProjectMapping(
    root: *,
    {
      gitlabProjectId,
      mapping
    }: {
      gitlabProjectId: string,
      mapping: TransitionMappingType
    }
  ): TransitionMappingType {
    const transitionApi = transitionProjectApi(encryptionKey, gitlabProjectId);
    transitionApi.set('mapping', mapping).write();
    return mapping;
  }

  function projectMapping(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): TransitionMappingType {
    return transitionProjectApi(encryptionKey, gitlabProjectId)
      .get('mapping')
      .value();
  }

  function projectLabels(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(encryptionKey, gitlabProjectId)
      .get('labels')
      .value();
  }

  function projectUsers(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(encryptionKey, gitlabProjectId)
      .get('users')
      .value();
  }

  function projectMilestones(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(encryptionKey, gitlabProjectId)
      .get('milestones')
      .value();
  }

  function projectIssues(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(encryptionKey, gitlabProjectId)
      .get('issues')
      .value();
  }

  function projectMeta(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(encryptionKey, gitlabProjectId)
      .get('meta')
      .value();
  }

  function migrateMilestones(
    root: *,
    {
      gitlabProjectId,
      jiraProjectId
    }: { gitlabProjectId: string, jiraProjectId: string },
    req: *
  ): TransitionMappingType {
    return createVersionsFromMilestones(
      encryptionKey,
      addon.httpClient(req),
      jiraProjectId,
      gitlabProjectId
    );
  }

  function createJiraVersionFromMilestone(
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
      success: createVersionFromMilestone(
        encryptionKey,
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
      setCredential(encryptionKey, 'gitlab', { appUrl, token });
      return {
        success: testGitlabCredentials(encryptionKey)
      };
    } catch (error) {
      console.error(error);
      return {
        success: false
      };
    }
  }

  function processProject(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string },
    req: *
  ): SuccessResponseType {
    startProcessingProject(
      encryptionKey,
      addon,
      req.context.clientKey,
      gitlabProjectId
    );
    return {
      success: true
    };
  }

  function retryFailure(
    root: *,
    { gitlabProjectId, issueIid }: { gitlabProjectId: string, issueIid: string }
  ): SuccessResponseType {
    reprocessFailure(encryptionKey, addon, issueIid, gitlabProjectId);
    return { success: true };
  }

  function retryAllFailures(): SuccessResponseType {
    reprocessAllFailures(encryptionKey, addon);
    return { success: true };
  }

  function getWebhookMetadata(root: *, params: *, req: *): WebhookMetadataType {
    return coreGetWebhookMetadata(encryptionKey, req.context.clientKey, true);
  }

  function setWebhookMetadata(
    root: *,
    { metadata }: { metadata: WebhookMetadataType },
    req: *
  ): WebhookMetadataType {
    coreSetWebhookMetadata(encryptionKey, req.context.clientKey, metadata);
    return metadata;
  }

  function createGitlabWebhooks(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string },
    req: *
  ): WebhookProjectStatusType {
    return createWebhooks(
      encryptionKey,
      gitlabProjectId,
      req.protocol + '://' + req.get('host'),
      req.context.clientKey
    );
  }

  function webhooks(): WebhookProjectStatusType[] {
    return allProjects(encryptionKey);
  }

  processQueue(encryptionKey, addon);

  // bind all these functions to pass in the addon/jira api
  return {
    Queries: {
      isSetup,
      jiraProjects,
      gitlabProjects,
      processingFailures,
      processingProjects,
      processingProject,
      projectMapping,
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
      webhooks
    },
    Mutations: {
      setGitlabCredentials,
      loadGitlabProject,
      setProjectMapping,
      setWebhookMetadata,
      createGitlabWebhooks,
      processProject,
      createJiraVersionFromMilestone,
      migrateMilestones,
      retryFailure,
      retryAllFailures
    }
  };
}
