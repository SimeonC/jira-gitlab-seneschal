// @flow
import React, { Component } from 'react';
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import Select from '@atlaskit/select/dist/esm/Select';
import { Field, FormSection } from '@atlaskit/form';
import Button from '@atlaskit/button';
import Spinner from '@atlaskit/spinner';

import {
  FormRow,
  idFind,
  getDefaultOptionValue,
  getIconUrlOptionLabel,
  getStatusOptionLabel,
  MinWidthFieldWrapper
} from './utils';
import type { TransitionMappingStatusType } from '../../../server/transition/types';
import sanitizeData from '../../sanitizeData';

type PropsType = {
  jiraData: *,
  labels: string[],
  projectId: string
};

type StateType = {
  selectedIssueType?: *
};

const refetchQueries = ['MappingStatuses'];

const ListQuery = gql`
  query MappingStatuses($gitlabProjectId: String!) {
    projectMappingStatuses(gitlabProjectId: $gitlabProjectId) {
      id
      projectId
      gitlabLabel
      issueTypeId
      statusId
    }
  }
`;

const UpsertQuery = gql`
  mutation UpsertMappingStatus($status: MappingStatusesInput!) {
    upsertProjectMappingStatus(status: $status) {
      success
    }
  }
`;

const DeleteQuery = gql`
  mutation DeleteMappingStatus($id: Int!) {
    deleteProjectMappingStatus(id: $id) {
      success
    }
  }
`;

export default class Statuses extends Component<PropsType> {
  render() {
    const { projectId, jiraData, labels } = this.props;
    return (
      <Query query={ListQuery} variables={{ gitlabProjectId: projectId }}>
        {({ data = {}, loading, error }) => {
          if (loading) return <Spinner />;
          if (error) {
            console.error(error);
            return <div>Error, check console.</div>;
          }
          return (
            <FormSection name="issue-types">
              <MinWidthFieldWrapper>
                <h3>Map GitLab labels to issue statuses</h3>
                {data.projectMappingStatuses.map((status) => (
                  <StatusMap
                    key={status.id}
                    tags={labels}
                    jiraData={jiraData}
                    data={status}
                  />
                ))}
                <Mutation
                  mutation={UpsertQuery}
                  refetchQueries={refetchQueries}
                >
                  {(upsert) => (
                    <NewStatusMap
                      tags={labels}
                      jiraData={jiraData}
                      upsert={upsert}
                      projectId={projectId}
                    />
                  )}
                </Mutation>
              </MinWidthFieldWrapper>
            </FormSection>
          );
        }}
      </Query>
    );
  }
}

class NewStatusMap extends Component<
  {
    projectId: string,
    tags: string[],
    jiraData: *,
    upsert: (status: *) => void
  },
  { data: { gitlabLabel?: string, issueTypeId?: string, statusId?: string } }
> {
  constructor(props: *) {
    super(props);

    this.state = {
      data: {
        projectId: props.projectId
      }
    };
  }

  update = (status: *) => {
    this.setState({ data: status });
  };

  save = () => {
    const status = this.state.data;
    if (!status.gitlabLabel || !status.issueTypeId || !status.statusId) {
      return;
    }
    this.props.upsert({ variables: { status } });
  };

  render() {
    const { tags, jiraData } = this.props;
    const { data } = this.state;
    return (
      <StatusMapping
        tags={tags}
        jiraData={jiraData}
        // $FlowFixMe
        data={data}
        upsert={this.update}
        create={this.save}
      />
    );
  }
}

const StatusMap = (props: {
  tags: string[],
  jiraData: *,
  data: TransitionMappingStatusType
}) => (
  <Mutation mutation={UpsertQuery} refetchQueries={refetchQueries}>
    {(upsert) => (
      <Mutation mutation={DeleteQuery} refetchQueries={refetchQueries}>
        {(remove) => (
          <StatusMapping
            {...props}
            upsert={(status) =>
              upsert({ variables: { status: sanitizeData(status) } })
            }
            remove={(status) => remove({ variables: { id: status.id } })}
          />
        )}
      </Mutation>
    )}
  </Mutation>
);

type StatusPropsType = {
  tags: string[],
  jiraData: *,
  data: TransitionMappingStatusType,
  upsert: (issueType: *) => void,
  remove?: (issueType: *) => void,
  create?: () => void
};

class StatusMapping extends Component<StatusPropsType, StateType> {
  constructor(props: StatusPropsType) {
    super(props);
    this.state = {
      selectedIssueType: idFind(
        props.data.issueTypeId,
        props.jiraData.jiraIssueTypes,
        false
      )
    };
  }

  remove = () => {
    if (this.props.remove) {
      this.props.remove(this.props.data);
    }
  };

  selectIssueType = (option: *) => {
    this.setState({
      selectedIssueType: option
    });
    this.props.upsert({
      ...this.props.data,
      issueTypeId: option.id
    });
  };

  selectIssueStatus = (option: *) => {
    this.props.upsert({
      ...this.props.data,
      statusId: option.id
    });
  };

  selectTag = ({ value }: *) => {
    this.props.upsert({
      ...this.props.data,
      gitlabLabel: value
    });
  };

  render() {
    const { data, tags, jiraData, remove, create } = this.props;
    const { selectedIssueType } = this.state;
    let selectedIssueTypeStatuses = [];
    if (selectedIssueType) {
      selectedIssueTypeStatuses = selectedIssueType.statuses;
    }
    return (
      <FormRow>
        <Field label="Pick GitLab Tag" name="gitlabLabel">
          {() => (
            <Select
              options={tags.map((tag) => ({ value: tag, label: tag }))}
              onChange={this.selectTag}
              defaultValue={{ label: data.gitlabLabel }}
            />
          )}
        </Field>
        <Field label="Pick Issue Type" name="issueTypeId">
          {() => (
            <Select
              options={jiraData.jiraIssueTypes}
              getOptionValue={getDefaultOptionValue}
              getOptionLabel={getIconUrlOptionLabel}
              onChange={this.selectIssueType}
              defaultValue={idFind(data.issueTypeId, jiraData.jiraIssueTypes)}
            />
          )}
        </Field>
        <Field label="Pick Status" name="statusId">
          {() => (
            <Select
              options={selectedIssueTypeStatuses}
              getOptionValue={getDefaultOptionValue}
              getOptionLabel={getStatusOptionLabel}
              onChange={this.selectIssueStatus}
              defaultValue={idFind(
                data.statusId,
                selectedIssueTypeStatuses,
                false
              )}
            />
          )}
        </Field>
        {remove && (
          <Button appearance="danger" onClick={this.remove}>
            Delete
          </Button>
        )}
        {create && (
          <Button appearance="primary" onClick={create}>
            Create
          </Button>
        )}
      </FormRow>
    );
  }
}
