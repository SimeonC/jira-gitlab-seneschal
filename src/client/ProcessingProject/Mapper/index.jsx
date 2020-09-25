// @flow
import React, { Component, Fragment, type Element } from 'react';
import { Query, Mutation } from '@apollo/client/react/components';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import get from 'lodash/get';
import Spinner from '@atlaskit/spinner';
import { gql } from '@apollo/client';
import Select from '@atlaskit/select/dist/esm/Select';
import Button from '@atlaskit/button/loading-button';
import Form, { Field } from '@atlaskit/form';
import ReactJson from 'react-json-view';
import type { TransitionMappingType } from '../../../server/transition/types';
import sanitizeData from '../../sanitizeData';
import {
  idFind,
  getDefaultOptionValue,
  getProjectOptionLabel,
  getComponentOptionLabel
} from './utils';

import DefaultIssue from './DefaultIssue';
import IssueTypes from './IssueTypes';
import Statuses from './Statuses';
import Components from './Components';
import Priorities from './Priorities';

type UpdateMappingFunctionType = ({
  variables?: { mapping: * },
  update?: (store: *, response: { data: *, loading: boolean, error: * }) => void
}) => void;

const Columns = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1 1 100%;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
`;

const mainQuery = gql`
  query QueryAll($gitlabProjectId: String!) {
    jiraProjects {
      id
      key
      name
    }
    projectLabels(gitlabProjectId: $gitlabProjectId)
    projectMilestones(gitlabProjectId: $gitlabProjectId) {
      id
      iid
      title
      description
      state
      dueDate
      startDate
      webUrl
    }
    projectMapping(gitlabProjectId: $gitlabProjectId) {
      jiraProjectId
      defaultComponentIds
      defaultIssueTypeId
      defaultIssueTypeClosedStatusId
      defaultResolutionId
    }
  }
`;

type JiraProjectSelectorPropsType = {
  projects: *[],
  mapping: TransitionMappingType,
  children: (jiraProjectId: string) => Element<any>,
  updateMapping: UpdateMappingFunctionType
};
class JiraProjectSelector extends Component<
  JiraProjectSelectorPropsType,
  { jiraProjectId: ?string, defaultValue?: * }
> {
  constructor(props: JiraProjectSelectorPropsType) {
    super(props);
    this.state = {
      jiraProjectId: null
    };
    const jiraProjectId = get(props, 'mapping.jiraProjectId');
    if (jiraProjectId) {
      this.state = {
        jiraProjectId,
        defaultValue: this.props.projects.find(({ id }) => id === jiraProjectId)
      };
    }
  }

  selectJiraProject = (option) => {
    this.setState({
      jiraProjectId: option.id
    });
    this.props.updateMapping({
      variables: {
        mapping: sanitizeData({
          ...this.props.mapping,
          jiraProjectId: option.id
        })
      }
    });
  };

  render() {
    return (
      <Fragment>
        <Field label="Select Jira Project to map to" name="jiraProjectId">
          {() => (
            <Select
              options={this.props.projects}
              getOptionValue={getDefaultOptionValue}
              getOptionLabel={getProjectOptionLabel}
              onChange={this.selectJiraProject}
              defaultValue={this.state.defaultValue}
            />
          )}
        </Field>
        {!this.state.jiraProjectId
          ? null
          : this.props.children(this.state.jiraProjectId)}
      </Fragment>
    );
  }
}

class MappingEditor extends Component<{
  update: UpdateMappingFunctionType,
  labels: string[],
  data: *,
  jiraData: *,
  projectId: string
}> {
  update = ({ updated_src }) => {
    this.props.update({
      variables: {
        mapping: sanitizeData(updated_src)
      }
    });
  };

  selectDefaultComponents = (options) => {
    const updated = {
      ...this.props.data,
      defaultComponentIds: options.map((option) => option.id)
    };
    this.props.update({
      variables: {
        mapping: sanitizeData(updated)
      }
    });
  };

  render() {
    const { projectId, data, labels, jiraData, update } = this.props;
    return (
      <Form name="mapping">
        {({ formProps }) => (
          <form {...formProps}>
            <Field
              label="Select default components to apply to all issues"
              name="defaultComponentids"
            >
              {() => (
                <Select
                  options={jiraData.jiraComponents}
                  isMulti
                  getOptionValue={getDefaultOptionValue}
                  getOptionLabel={getComponentOptionLabel}
                  onChange={this.selectDefaultComponents}
                  defaultValue={(data.defaultComponentIds || []).map((id) =>
                    idFind(id, jiraData.jiraComponents)
                  )}
                />
              )}
            </Field>
            <DefaultIssue jiraData={jiraData} data={data} update={update} />
            <IssueTypes
              projectId={projectId}
              jiraData={jiraData}
              labels={labels}
            />
            <Statuses
              projectId={projectId}
              jiraData={jiraData}
              labels={labels}
            />
            <Components
              projectId={projectId}
              jiraData={jiraData}
              labels={labels}
            />
            <Priorities
              projectId={projectId}
              jiraData={jiraData}
              labels={labels}
            />
            <h4>Debug Details</h4>
            <ReactJson
              src={sanitizeData(data)}
              onEdit={this.update}
              onAdd={this.update}
              onDelete={this.update}
            />
          </form>
        )}
      </Form>
    );
  }
}

class Mapping extends Component<{
  gitlabProjectId: string,
  data: *,
  history: *
}> {
  static contextTypes = {
    client: PropTypes.object
  };

  updateMappingCache = (store: *, updateFunction: (*) => *) => {
    const variables = {
      gitlabProjectId: this.props.gitlabProjectId
    };
    const mappingData = store.readQuery({ query: mainQuery, variables });
    const updatedData = updateFunction(mappingData);
    store.writeQuery({
      query: mainQuery,
      data: updatedData,
      variables
    });
    this.context.client.queryManager.broadcastQueries();
  };

  genericMappingUpdate = (store, { data }) => {
    this.updateMappingCache(store, (oldData) => ({
      ...oldData,
      projectMapping: {
        ...data.setProjectMapping,
        __typename: 'TransitionProjectMapping'
      }
    }));
  };

  redirectAfterProcessing = () => {
    this.props.history.push('/migrations');
  };

  render() {
    const { data, gitlabProjectId } = this.props;
    return (
      <Mutation
        mutation={gql`
          mutation UpdateMappingData($mapping: TransitionProjectMappingInput!) {
            setProjectMapping(gitlabProjectId: "${gitlabProjectId}", mapping: $mapping) {
              jiraProjectId
              defaultComponentIds
              defaultIssueTypeId
              defaultIssueTypeClosedStatusId
              defaultResolutionId
            }
          }
        `}
        update={this.genericMappingUpdate}
      >
        {(updateMapping) => (
          <JiraProjectSelector
            projects={data.jiraProjects}
            mapping={data.projectMapping}
            updateMapping={updateMapping}
          >
            {(jiraProjectId) => (
              <Query
                variables={{ projectId: jiraProjectId }}
                query={gql`
                  query JiraProperties($projectId: String!) {
                    jiraIssueTypes(projectId: $projectId) {
                      id
                      name
                      iconUrl
                      statuses {
                        id
                        name
                        description
                        iconUrl
                        statusCategory {
                          colorName
                        }
                      }
                    }
                    jiraVersions(projectId: $projectId) {
                      id
                      name
                      description
                      released
                    }
                    jiraComponents(projectId: $projectId) {
                      id
                      name
                      description
                    }
                    jiraResolutions {
                      id
                      name
                      description
                    }
                    jiraPriorities {
                      statusColor
                      description
                      iconUrl
                      name
                      id
                    }
                  }
                `}
              >
                {({ data: jiraData = {}, loading, error }) => {
                  if (loading) {
                    return <Spinner />;
                  }
                  if (error) {
                    console.error(error);
                    return <div>Problem happened, plz wait.</div>;
                  }
                  return (
                    <div>
                      <Columns>
                        <Column>
                          <Mutation
                            mutation={gql`
                              mutation StartProcessing(
                                $gitlabProjectId: String!
                              ) {
                                processProject(
                                  gitlabProjectId: $gitlabProjectId
                                ) {
                                  success
                                }
                              }
                            `}
                            variables={{ gitlabProjectId }}
                            update={this.redirectAfterProcessing}
                          >
                            {(startProcess, { loading, error }) => (
                              <div>
                                <Button
                                  appearance="primary"
                                  isLoading={loading}
                                  onClick={startProcess}
                                >
                                  Run Transformation
                                </Button>
                                {error && (
                                  <ReactJson
                                    src={sanitizeData(error)}
                                    displayDataTypes={false}
                                  />
                                )}
                              </div>
                            )}
                          </Mutation>
                          <MappingEditor
                            projectId={gitlabProjectId}
                            update={updateMapping}
                            data={data.projectMapping}
                            labels={data.projectLabels}
                            jiraData={jiraData}
                          />
                          <h4>GitLab Labels</h4>
                          <ReactJson
                            src={sanitizeData(data.projectLabels)}
                            displayDataTypes={false}
                          />
                          <h4>GitLab Milestones</h4>
                          <ReactJson
                            src={sanitizeData(data.projectMilestones)}
                            displayDataTypes={false}
                            collapsed={true}
                          />
                          <h4>Jira Properties</h4>
                          <ReactJson
                            src={sanitizeData(jiraData)}
                            displayDataTypes={false}
                            collapsed={true}
                          />
                        </Column>
                      </Columns>
                    </div>
                  );
                }}
              </Query>
            )}
          </JiraProjectSelector>
        )}
      </Mutation>
    );
  }
}

export default class Mapper extends Component<{
  gitlabProjectId: string,
  history: *
}> {
  render() {
    const { gitlabProjectId, history } = this.props;
    if (!gitlabProjectId) {
      return (
        <div>
          No Project ID passed, go <Link to="/">Home</Link>
        </div>
      );
    }
    return (
      <Query
        query={mainQuery}
        variables={{
          gitlabProjectId
        }}
      >
        {({ loading, data = {} }) => {
          if (loading) return <Spinner />;
          return (
            <Mapping
              data={data}
              history={history}
              gitlabProjectId={gitlabProjectId}
            />
          );
        }}
      </Query>
    );
  }
}
