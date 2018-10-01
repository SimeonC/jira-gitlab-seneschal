// @flow
import mapKeys from 'lodash/mapKeys';
import camelCase from 'lodash/camelCase';
import gitlabApi from './apis/gitlab';
import { jiraRequest } from './apis/jira';
import { setCredential } from './apis/credentials';
import {
  allProjects,
  getWebhookMetadata as coreGetWebhookMetadata,
  setWebhookMetadata as coreSetWebhookMetadata
} from './apis/webhooks';
import loadGitlabProjectIssues from './transition/loadIssues';
import type { TransitionMappingType } from './transition/types';
import transitionProjectApi from './apis/transitionProject';
import {
  processQueue,
  projectStatuses,
  reprocessAllFailures,
  reprocessFailure,
  startProcessingProject
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

async function testGitlabCredentials(credentialPassword: string) {
  try {
    await gitlabApi(credentialPassword).Users.current();
    return true;
  } catch (err) {
    return false;
  }
}

export default function(credentialPassword: string, addon: *) {
  async function isSetup() {
    return {
      success: await testGitlabCredentials(credentialPassword)
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
    const projects = await gitlabApi(credentialPassword).Projects.all({
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
    return await loadGitlabProjectIssues(
      gitlabApi(credentialPassword),
      projectId
    );
  }

  function processingProjects() {
    return projectStatuses();
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
    const transitionApi = transitionProjectApi(gitlabProjectId);
    transitionApi.set('mapping', mapping).write();
    return mapping;
  }

  function projectMapping(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): TransitionMappingType {
    return transitionProjectApi(gitlabProjectId)
      .get('mapping')
      .value();
  }

  function projectLabels(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(gitlabProjectId)
      .get('labels')
      .value();
  }

  function projectUsers(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(gitlabProjectId)
      .get('users')
      .value();
  }

  function projectMilestones(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(gitlabProjectId)
      .get('milestones')
      .value();
  }

  function projectIssues(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(gitlabProjectId)
      .get('issues')
      .value();
  }

  function projectMeta(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string }
  ): * {
    return transitionProjectApi(gitlabProjectId)
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
      setCredential(credentialPassword, 'gitlab', { appUrl, token });
      return {
        success: testGitlabCredentials(credentialPassword)
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
      addon,
      credentialPassword,
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
    reprocessFailure(addon, credentialPassword, issueIid, gitlabProjectId);
    return { success: true };
  }

  function retryAllFailures(): SuccessResponseType {
    reprocessAllFailures(addon, credentialPassword);
    return { success: true };
  }

  function getWebhookMetadata(root: *, params: *, req: *): WebhookMetadataType {
    return coreGetWebhookMetadata(req.context.clientKey, true);
  }

  function setWebhookMetadata(
    root: *,
    { metadata }: { metadata: WebhookMetadataType },
    req: *
  ): WebhookMetadataType {
    coreSetWebhookMetadata(req.context.clientKey, metadata);
    return metadata;
  }

  function createGitlabWebhooks(
    root: *,
    { gitlabProjectId }: { gitlabProjectId: string },
    req: *
  ): WebhookProjectStatusType {
    return createWebhooks(
      credentialPassword,
      gitlabProjectId,
      req.protocol + '://' + req.get('host'),
      req.context.clientKey
    );
  }

  function webhooks(): WebhookProjectStatusType[] {
    return allProjects();
  }

  processQueue(addon, credentialPassword);

  // bind all these functions to pass in the addon/jira api
  return {
    Queries: {
      isSetup,
      jiraProjects,
      gitlabProjects,
      processingProjects,
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
