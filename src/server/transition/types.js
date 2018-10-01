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
  gitlabLabel: string,
  componentId: string
};

export type TransitionMappingVersionType = {
  milestoneId: string,
  versionId: string
};

export type TransitionMappingIssueTypeType = {
  gitlabLabel: string,
  closedStatusId: string,
  issueTypeId: string
};

export type TransitionMappingStatusType = {
  gitlabLabel: string,
  issueTypeId: string,
  statusId: string
};

export type TransitionMappingPriorityType = {
  gitlabLabel: string,
  priorityId: string
};

export type TransitionMappingType = {
  baseValues: {
    project: ?{
      id: string
    },
    components?: IdType[]
  },
  defaultIssueTypeId: string,
  defaultIssueTypeClosedStatusId: string,
  defaultResolutionId: string,
  issueTypes: TransitionMappingIssueTypeType[],
  statuses: TransitionMappingStatusType[],
  versions: TransitionMappingVersionType[],
  components: TransitionMappingComponentType[],
  priorities: TransitionMappingPriorityType[]
};
