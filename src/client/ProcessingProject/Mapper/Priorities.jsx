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
  MinWidthFieldWrapper
} from './utils';
import type { TransitionMappingPriorityType } from '../../../server/transition/types';
import sanitizeData from '../../sanitizeData';

type PropsType = {
  jiraData: *,
  labels: string[],
  projectId: string
};

const refetchQueries = ['MappingPriorities'];

const ListQuery = gql`
  query MappingPriorities($gitlabProjectId: String!) {
    projectMappingPriorities(gitlabProjectId: $gitlabProjectId) {
      id
      projectId
      gitlabLabel
      priorityId
    }
  }
`;

const UpsertQuery = gql`
  mutation UpsertMappingPriority($priority: MappingPriorityInput!) {
    upsertProjectMappingPriority(priority: $priority) {
      success
    }
  }
`;

const DeleteQuery = gql`
  mutation DeleteMappingPriority($id: Int!) {
    deleteProjectMappingPriority(id: $id) {
      success
    }
  }
`;

export default class MappingPrioirities extends Component<PropsType> {
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
            <FormSection name="priorities">
              <MinWidthFieldWrapper>
                <h3>Map GitLab labels to priorities</h3>
                {data.projectMappingPriorities.map((priority) => (
                  <PriorityMap
                    key={priority.id}
                    tags={labels}
                    jiraData={jiraData}
                    data={priority}
                  />
                ))}
                <Mutation
                  mutation={UpsertQuery}
                  refetchQueries={refetchQueries}
                >
                  {(upsert) => (
                    <NewPriorityMap
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

class NewPriorityMap extends Component<
  {
    projectId: string,
    tags: string[],
    jiraData: *,
    upsert: (priority: *) => void
  },
  { data: { gitlabLabel?: string, priorityId?: string } }
> {
  constructor(props: *) {
    super(props);

    this.state = {
      data: {
        projectId: props.projectId
      }
    };
  }

  update = (priority: *) => {
    this.setState({ data: priority });
  };

  save = () => {
    const priority = this.state.data;
    if (!priority.priorityId || !priority.gitlabLabel) return;
    this.props.upsert({ variables: { priority } });
  };

  render() {
    const { tags, jiraData } = this.props;
    const { data } = this.state;
    return (
      <PriorityMapping
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

const PriorityMap = (props: {
  tags: string[],
  jiraData: *,
  data: TransitionMappingPriorityType
}) => (
  <Mutation mutation={UpsertQuery} refetchQueries={refetchQueries}>
    {(upsert) => (
      <Mutation mutation={DeleteQuery} refetchQueries={refetchQueries}>
        {(remove) => (
          <PriorityMapping
            {...props}
            upsert={(priority) =>
              upsert({ variables: { priority: sanitizeData(priority) } })
            }
            remove={(priority) => remove({ variables: { id: priority.id } })}
          />
        )}
      </Mutation>
    )}
  </Mutation>
);

type PriorityPropsType = {
  tags: string[],
  jiraData: *,
  data: TransitionMappingPriorityType,
  upsert: (priority: *) => void,
  remove?: (priority: *) => void,
  create?: () => void
};

class PriorityMapping extends Component<PriorityPropsType> {
  remove = () => {
    if (this.props.remove) {
      this.props.remove(this.props.data);
    }
  };

  selectPriority = (option: *) => {
    this.props.upsert({
      ...this.props.data,
      priorityId: option.id
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
        <Field label="Pick Priority" name="priorityId">
          {() => (
            <Select
              options={jiraData.jiraPriorities}
              getOptionValue={getDefaultOptionValue}
              getOptionLabel={getIconUrlOptionLabel}
              onChange={this.selectPriority}
              defaultValue={idFind(data.priorityId, jiraData.jiraPriorities)}
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
