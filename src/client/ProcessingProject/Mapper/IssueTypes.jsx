// @flow
import React, { Component } from 'react';
import { Query, Mutation } from '@apollo/client/react/components';
import { gql } from '@apollo/client';
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
import type { TransitionMappingIssueTypeType } from '../../../server/transition/types';
import sanitizeData from '../../sanitizeData';

type PropsType = {
  jiraData: *,
  labels: string[],
  projectId: string
};

type StateType = {
  selectedIssueType?: *
};

const refetchQueries = ['MappingIssueTypes'];

const ListQuery = gql`
  query MappingIssueTypes($gitlabProjectId: String!) {
    projectMappingIssueTypes(gitlabProjectId: $gitlabProjectId) {
      id
      projectId
      gitlabLabel
      issueTypeId
      closedStatusId
    }
  }
`;

const UpsertQuery = gql`
  mutation UpsertMappingIssueType($issueType: MappingIssueTypeInput!) {
    upsertProjectMappingIssueType(issueType: $issueType) {
      success
    }
  }
`;

const DeleteQuery = gql`
  mutation DeleteMappingIssueType($id: Int!) {
    deleteProjectMappingIssueType(id: $id) {
      success
    }
  }
`;

export default class MappingIssueTypes extends Component<PropsType> {
  render() {
    const { projectId, labels, jiraData } = this.props;
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
                <h3>Map GitLab labels to issue types</h3>
                {data.projectMappingIssueTypes.map((issueType) => (
                  <IssueTypeMap
                    key={issueType.id}
                    tags={labels}
                    jiraData={jiraData}
                    data={issueType}
                  />
                ))}
                <Mutation
                  mutation={UpsertQuery}
                  refetchQueries={refetchQueries}
                >
                  {(upsert) => (
                    <NewIssueTypeMap
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

class NewIssueTypeMap extends Component<
  {
    projectId: string,
    tags: string[],
    jiraData: *,
    upsert: (issueType: *) => void
  },
  {
    data: {
      gitlabLabel?: string,
      issueTypeId?: string,
      closedStatusId?: string
    }
  }
> {
  constructor(props: *) {
    super(props);

    this.state = {
      data: {
        projectId: props.projectId
      }
    };
  }

  update = (issueType: *) => {
    this.setState({ data: issueType });
  };

  save = () => {
    const issueType = this.state.data;
    if (
      !issueType.gitlabLabel ||
      !issueType.issueTypeId ||
      !issueType.closedStatusId
    ) {
      return;
    }
    this.props.upsert({ variables: { issueType } });
  };

  render() {
    const { tags, jiraData } = this.props;
    const { data } = this.state;
    return (
      <IssueTypeMapping
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

const IssueTypeMap = (props: {
  tags: string[],
  jiraData: *,
  data: TransitionMappingIssueTypeType
}) => (
  <Mutation mutation={UpsertQuery} refetchQueries={refetchQueries}>
    {(upsert) => (
      <Mutation mutation={DeleteQuery} refetchQueries={refetchQueries}>
        {(remove) => (
          <IssueTypeMapping
            {...props}
            upsert={(issueType) =>
              upsert({ variables: { issueType: sanitizeData(issueType) } })
            }
            remove={(issueType) => remove({ variables: { id: issueType.id } })}
          />
        )}
      </Mutation>
    )}
  </Mutation>
);

type IssueTypePropsType = {
  tags: string[],
  jiraData: *,
  data: TransitionMappingIssueTypeType,
  upsert: (issueType: *) => void,
  remove?: (issueType: *) => void,
  create?: () => void
};

class IssueTypeMapping extends Component<IssueTypePropsType, StateType> {
  constructor(props: IssueTypePropsType) {
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

  selectClosedStatus = (option: *) => {
    this.props.upsert({
      ...this.props.data,
      closedStatusId: option.id
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
        <Field label="Pick Closed Status" name="closedStatusId">
          {() => (
            <Select
              options={selectedIssueTypeStatuses}
              getOptionValue={getDefaultOptionValue}
              getOptionLabel={getStatusOptionLabel}
              onChange={this.selectClosedStatus}
              defaultValue={idFind(
                data.closedStatusId,
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
