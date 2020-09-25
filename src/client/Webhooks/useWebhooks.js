// @flow
import { useCallback } from 'react';
import { gql, useMutation } from '@apollo/client';

export const webhooksQuery = gql`
  {
    webhooks {
      id
      name
      url
      status
      outOfDate
    }
  }
`;
const updateWebhookMutation = gql`
  mutation CreateWebhook($gitlabProjectId: String!) {
    createGitlabWebhooks(gitlabProjectId: $gitlabProjectId) {
      id
      name
      url
      status
    }
  }
`;

export function useUpdateWebhook() {
  const [createWebhook, status] = useMutation(updateWebhookMutation);

  const updateWebhook = useCallback(
    (gitlabProjectId) => {
      if (!gitlabProjectId) return;
      createWebhook({
        variables: {
          gitlabProjectId: `${gitlabProjectId}`
        },
        update: (store, { data: { createGitlabWebhooks } }) => {
          const cachedData = store.readQuery({
            query: webhooksQuery
          });
          const existingHook = cachedData.webhooks.find(
            ({ id }) => id === gitlabProjectId
          );
          if (existingHook) {
            const index = cachedData.webhooks.indexOf(existingHook);
            if (createGitlabWebhooks) {
              cachedData.webhooks.splice(index, 1, createGitlabWebhooks);
            } else {
              cachedData.webhooks.splice(index, 1);
            }
          } else if (createGitlabWebhooks) {
            cachedData.webhooks.push(createGitlabWebhooks);
          }
          store.writeQuery({
            query: webhooksQuery,
            data: cachedData
          });
        }
      });
    },
    [createWebhook]
  );
  return [updateWebhook, status];
}
