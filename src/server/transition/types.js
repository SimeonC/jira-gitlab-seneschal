// @flow
export type IdType = {
  id: string
};

export type GitlabMilestoneType = {
  id: number,
  iid: number,
  project_id: number,
  title: string,
  description?: string,
  state: 'active' | 'closed',
  due_date: string,
  start_date: string,
  web_url: string
};

export type TransitionMappingComponentType = {
  id: number,
  gitlabLabel: string,
  componentId: string
};

export type TransitionMappingVersionType = {
  id: number,
  milestoneId: string,
  versionId: string
};

export type TransitionMappingIssueTypeType = {
  id: number,
  gitlabLabel: string,
  closedStatusId: string,
  issueTypeId: string
};

export type TransitionMappingStatusType = {
  id: number,
  gitlabLabel: string,
  issueTypeId: string,
  statusId: string
};

export type TransitionMappingPriorityType = {
  id: number,
  gitlabLabel: string,
  priorityId: string
};

export type TransitionMappingType = {
  jiraProjectId: string,
  defaultComponentIds: [string],
  defaultIssueTypeId: string,
  defaultIssueTypeClosedStatusId: string,
  defaultResolutionId: string
};

export type ProcessingProjectType = {
  projectId: string,
  meta: *,
  isProcessing: boolean,
  isLoading: boolean,
  completedCount: number,
  failedCount: number,
  totalCount: number,
  currentMessage: string,
  currentIssueIid: string
};
