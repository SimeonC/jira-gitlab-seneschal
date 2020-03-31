import axios from 'axios';
import { getDevToolsToken } from '../apis/credentials';
import { version as appVersion } from '../../../package';

export default async function sendDevInfo(
  jiraAddon,
  clientKey,
  baseJiraUrl,
  { updateSequenceId, project, commits = [], pullRequests = [], branches = [] }
) {
  const developmentToolData = {
    id: `gitlab-senechal-project-${project.id}`,
    name: project.path_with_namespace,
    url: project.web_url,
    updateSequenceId,
    commits,
    branches,
    pullRequests
  };
  const bearerToken = await getDevToolsToken(jiraAddon, clientKey);
  if (!bearerToken) return;
  const {
    data: { cloudId }
  } = await axios.get(`${baseJiraUrl}/_edge/tenant_info`);
  try {
    const devToolsResponse = await axios.post(
      `https://api.atlassian.com/jira/devinfo/0.1/cloud/${cloudId}/bulk`,
      {
        repositories: [developmentToolData],
        providerMetadata: { product: `GitLab Seneschal v${appVersion}` },
        properties: {},
        preventTransitions: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearerToken
        }
      }
    );
  } catch (error) {
    throw error;
  }
}
