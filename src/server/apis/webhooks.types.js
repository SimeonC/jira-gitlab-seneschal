// @flow
export type WebhookType = $Values<typeof WEBHOOK_TYPES>;

export const WEBHOOK_TYPES = {
  COMMENTS: 'note',
  MERGE_REQUESTS: 'merge_request'
};
export const WEBHOOK_TYPE_KEYS: string[] = Object.keys(WEBHOOK_TYPES).map(
  (key) => WEBHOOK_TYPES[key]
);

export type WebhookCredentialType = {
  secretKey: string,
  clientKey: string
};

export type WebhookTransitionMapsType = {
  jiraProjectKey: string,
  mergeStatusIds: string[],
  openStatusIds: string[],
  closeStatusIds: string[]
};

export type WebhookMetadataType = {
  transitionKeywords: string[],
  // this is a map of jiraProjectKey to transitionId
  transitionMap: WebhookTransitionMapsType[]
};

export type WebhookProjectStatusEnumType = 'pending' | 'healthy' | 'sick';

export type WebhookProjectStatusType = {
  id: string,
  name: string,
  url: string,
  status: WebhookProjectStatusEnumType
};
