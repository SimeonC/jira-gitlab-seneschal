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

export type WebhookTransitionMapType = {
  mergeStatusIds: string[],
  openStatusIds: string[],
  closeStatusIds: string[]
};

export type WebhookTransitionMapsType = WebhookTransitionMapType & {
  jiraProjectKey: string
};

export type WebhookMetadataType = {
  transitionKeywords: string[],
  // this is a map of jiraProjectKey to transitionId
  transitionMap: WebhookTransitionMapsType[],
  // This should only be 1/0 length
  defaultTransitionMap: WebhookTransitionMapsType[]
};

export type WebhookProjectStatusEnumType = 'pending' | 'healthy' | 'sick';

export type WebhookProjectStatusType = {
  id: string,
  name: string,
  url: string,
  status: WebhookProjectStatusEnumType
};

export type WebhookErrorType = {
  id: string,
  original: string,
  error: string
};
