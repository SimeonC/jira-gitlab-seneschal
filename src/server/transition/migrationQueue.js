//@flow
import createJiraIssue from './createJiraIssue';
import {
  getCredential,
  setCredential,
  clearCredential
} from '../apis/credentials';
import type { JiraCredential } from '../apis/credentials';
import type { DatabaseType } from '../models';
import createVersionsFromMilestones from './createVersions';

type QueueElement = {
  // gitlab project id
  projectId: string,
  issueIid: string
};

type ProcessingProject = {
  isProcessing: boolean,
  completedCount: number,
  failedCount: number,
  totalCount: number,
  currentMessage: string,
  currentIssueIid: string,
  meta: *
};

const JIRA_GITLAB_PROJECT_KEY = 'jira-client-key-for-gitlab-project';

let queueIsProcessing = false;

export async function reprocessAllFailures(jiraAddon: *) {
  const database = jiraAddon.schema.models;
  const failures = await database.MigrationFailures.findAll();
  await database.MigrationQueue.bulkCreate(
    failures.map(({ queueElement }) => ({
      projectId: queueElement.projectId,
      issueIid: queueElement.issueIid
    }))
  );
  const tempSql = jiraAddon.schema.dialect.QueryGenerator.selectQuery(
    'MigrationFailures',
    {
      attributes: [
        [jiraAddon.schema.json('queueElement.projectId'), 'projectId']
      ]
    }
  ).slice(0, -1); // to remove the ';' from the end of the SQL
  await database.MigrationProjects.update(
    { failedCount: 0 },
    {
      where: {
        projectId: {
          $in: jiraAddon.schema.literal(`(${tempSql})`)
        }
      }
    }
  );
  await database.MigrationFailures.truncate();

  // don't wait for the promise
  processQueue(jiraAddon);
}

export async function projectFailures(database: DatabaseType) {
  return await database.MigrationFailures.findAll();
}

export async function projectStatuses(
  database: DatabaseType
): Promise<
  (ProcessingProject & {
    projectId: string
  })[]
> {
  return await database.MigrationProjects.findAll();
}

export async function projectStatus(
  database: DatabaseType,
  gitlabProjectId: string
): Promise<?(ProcessingProject & {
  projectId: string
})> {
  return await database.MigrationProjects.findOne({
    where: {
      projectId: gitlabProjectId
    }
  });
}

export async function startProcessingProject(
  jiraAddon: *,
  jiraApi: *,
  clientKey: string,
  projectId: string
) {
  const database = jiraAddon.schema.models;
  const queryOptions = {
    where: {
      projectId
    }
  };
  await database.MigrationProjects.update(
    {
      isProcessing: true,
      currentMessage: 'Auto-migrating Milestones to Versions',
      completedCount: 0,
      failedCount: 0
    },
    queryOptions
  );
  const mapping = await database.MigrationMappings.findOne(queryOptions);
  await createVersionsFromMilestones(
    jiraAddon.schema.models,
    jiraApi,
    mapping.jiraProjectId,
    projectId
  );
  await database.MigrationProjects.update(
    {
      currentMessage: 'Starting migration'
    },
    queryOptions
  );
  await setCredential(
    database,
    jiraAddon.config.CREDENTIAL_ENCRYPTION_KEY(),
    `${JIRA_GITLAB_PROJECT_KEY}-${projectId}`,
    {
      token: clientKey
    }
  );
  const issues = await database.MigrationIssues.findAll(queryOptions);
  await database.MigrationProjects.update(
    {
      totalCount: issues.length
    },
    queryOptions
  );
  await database.MigrationQueue.bulkCreate(
    issues.map(({ iid }) => ({ projectId, issueIid: `${iid}` }))
  );

  // intentionally not awaiting this promise
  processQueue(jiraAddon);
}

export async function clearProject(addon: *, projectId: string) {
  await clearCredential(addon, `${JIRA_GITLAB_PROJECT_KEY}-${projectId}`);
  await new Promise((resolve) =>
    addon.schema.transaction(async (transaction) => {
      const queryOptions = {
        transaction,
        where: {
          projectId
        }
      };
      await addon.schema.models.MigrationIssues.destroy(queryOptions);
      await addon.schema.models.MigrationLabels.destroy(queryOptions);
      await addon.schema.models.MigrationMappingComponents.destroy(
        queryOptions
      );
      await addon.schema.models.MigrationMappingIssueTypes.destroy(
        queryOptions
      );
      await addon.schema.models.MigrationMappingPriorities.destroy(
        queryOptions
      );
      await addon.schema.models.MigrationMappings.destroy(queryOptions);
      await addon.schema.models.MigrationMappingStatuses.destroy(queryOptions);
      await addon.schema.models.MigrationMappingVersions.destroy(queryOptions);
      await addon.schema.models.MigrationMilestones.destroy(queryOptions);
      await addon.schema.models.MigrationProjects.destroy(queryOptions);
      await addon.schema.models.MigrationUsers.destroy(queryOptions);
      resolve();
    })
  );
}

async function initJiraApi(
  addon: *,
  gitlabProjectId: string
): { api: *, baseUrl: string } {
  const jiraCredentials: JiraCredential = (await getCredential(
    addon.schema.models,
    addon.config.CREDENTIAL_ENCRYPTION_KEY(),
    `${JIRA_GITLAB_PROJECT_KEY}-${gitlabProjectId}`
  ): any);
  // $FlowFixMe
  return {
    api: addon.httpClient({ clientKey: jiraCredentials.token }),
    ...(await addon.settings.get('clientInfo', jiraCredentials.token))
  };
}

async function unshiftQueueElement(
  database: DatabaseType
): Promise<?QueueElement> {
  const element = await database.MigrationQueue.findOne();
  if (!element) return null;
  await database.MigrationQueue.destroy({
    where: {
      id: element.id
    }
  });
  return element;
}

export async function processQueue(jiraAddon: *) {
  const database = jiraAddon.schema.models;
  if (queueIsProcessing) return;
  const queueLength = database.MigrationQueue.count();
  if (queueLength === 0) {
    return;
  }
  queueIsProcessing = true;

  let queueElement: ?QueueElement = await unshiftQueueElement(database);
  while (queueElement) {
    await processQueueElement(jiraAddon, queueElement);
    queueElement = await unshiftQueueElement(database);
  }
  queueIsProcessing = false;
}

async function processQueueElement(jiraAddon: *, queueElement: QueueElement) {
  const queryOptions = {
    where: {
      projectId: queueElement.projectId
    }
  };
  const database = jiraAddon.schema.models;

  await database.MigrationProjects.update(
    {
      currentIssueIid: queueElement.issueIid
    },
    queryOptions
  );
  try {
    await createJiraIssue(
      jiraAddon,
      queueElement.projectId,
      queueElement.issueIid,
      async (message) => {
        await database.MigrationProjects.update(
          {
            currentMessage: message
          },
          queryOptions
        );
      }
    );

    await database.MigrationProjects.increment('completedCount', queryOptions);
  } catch (error) {
    await database.MigrationProjects.increment('failedCount', queryOptions);
    console.error(error);
    await database.MigrationFailures.create({
      queueElement,
      error: error.response ? error.response.data : error.toString(),
      config: error.config
        ? {
            url: error.config.url,
            data: error.config.data
          }
        : null
    });
  }
}
