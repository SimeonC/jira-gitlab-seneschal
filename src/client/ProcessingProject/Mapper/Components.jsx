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
  getComponentOptionLabel,
  MinWidthFieldWrapper
} from './utils';
import type { TransitionMappingComponentType } from '../../../server/transition/types';
import sanitizeData from '../../sanitizeData';

type PropsType = {
  jiraData: *,
  labels: string[],
  projectId: string
};

const refetchQueries = ['MappingComponents'];

const ListQuery = gql`
  query MappingComponents($gitlabProjectId: String!) {
    projectMappingComponents(gitlabProjectId: $gitlabProjectId) {
      id
      projectId
      gitlabLabel
      componentId
    }
  }
`;

const UpsertQuery = gql`
  mutation UpsertMappingComponent($component: MappingComponentInput!) {
    upsertProjectMappingComponent(component: $component) {
      success
    }
  }
`;

const DeleteQuery = gql`
  mutation DeleteMappingComponent($id: Int!) {
    deleteProjectMappingComponent(id: $id) {
      success
    }
  }
`;

export default class MappingComponents extends Component<PropsType> {
  render() {
    const { projectId, labels, jiraData } = this.props;
    return (
      <Query query={ListQuery} variables={{ gitlabProjectId: projectId }}>
        {({ data, loading, error }) => {
          if (loading) return <Spinner />;
          if (error) {
            console.error(error);
            return <div>Error, check console.</div>;
          }
          return (
            <FormSection name="components">
              <MinWidthFieldWrapper>
                <h3>Map GitLab labels to components</h3>
                {data.projectMappingComponents.map((component) => (
                  <ComponentMap
                    key={component.id}
                    tags={labels}
                    jiraData={jiraData}
                    data={component}
                  />
                ))}
                <Mutation
                  mutation={UpsertQuery}
                  refetchQueries={refetchQueries}
                >
                  {(upsert) => (
                    <NewComponentMap
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

class NewComponentMap extends Component<
  {
    projectId: string,
    tags: string[],
    jiraData: *,
    upsert: (component: *) => void
  },
  { data: { gitlabLabel?: string, componentId?: string } }
> {
  constructor(props: *) {
    super(props);

    this.state = {
      data: {
        projectId: props.projectId
      }
    };
  }

  update = (component: *) => {
    this.setState({ data: component });
  };

  save = () => {
    const component = this.state.data;
    if (!component.componentId || !component.gitlabLabel) return;
    this.props.upsert({ variables: { component } });
  };

  render() {
    const { tags, jiraData } = this.props;
    const { data } = this.state;
    return (
      <ComponentMapping
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

const ComponentMap = (props: {
  tags: string[],
  jiraData: *,
  data: TransitionMappingComponentType
}) => (
  <Mutation mutation={UpsertQuery} refetchQueries={refetchQueries}>
    {(upsert) => (
      <Mutation mutation={DeleteQuery} refetchQueries={refetchQueries}>
        {(remove) => (
          <ComponentMapping
            {...props}
            upsert={(component) =>
              upsert({ variables: { component: sanitizeData(component) } })
            }
            remove={(component) => remove({ variables: { id: component.id } })}
          />
        )}
      </Mutation>
    )}
  </Mutation>
);

type ComponentPropsType = {
  tags: string[],
  jiraData: *,
  data: TransitionMappingComponentType,
  upsert: (component: *) => void,
  remove?: (component: *) => void,
  create?: () => void
};

class ComponentMapping extends Component<ComponentPropsType> {
  remove = () => {
    if (this.props.remove) {
      this.props.remove(this.props.data);
    }
  };

  selectComponent = (option: *) => {
    this.props.upsert({
      ...this.props.data,
      componentId: option.id
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
        <Field label="Pick GitLab Tag">
          <Select
            options={tags.map((tag) => ({ value: tag, label: tag }))}
            onChange={this.selectTag}
            defaultValue={{ label: data.gitlabLabel }}
          />
        </Field>
        <Field label="Pick Component">
          <Select
            options={jiraData.jiraComponents}
            getOptionValue={getDefaultOptionValue}
            getOptionLabel={getComponentOptionLabel}
            onChange={this.selectComponent}
            defaultValue={idFind(data.componentId, jiraData.jiraComponents)}
          />
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
