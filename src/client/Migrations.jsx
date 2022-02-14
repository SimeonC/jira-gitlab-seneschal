import React, { Component, Fragment } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/core';
import { Query, Mutation } from '@apollo/client/react/components';
import { gql } from '@apollo/client';
import { Link } from 'react-router-dom';

import Page, { Grid, GridColumn } from '@atlaskit/page';
import DynamicTable from '@atlaskit/dynamic-table';
import Spinner from '@atlaskit/spinner';
import Button from '@atlaskit/button/loading-button';
import BaseSelect from '@atlaskit/select';

const fullWidthCss = css`
  display: flex;
  flex: 1 1 100%;
`;

const Row = styled.div`
  ${fullWidthCss};
  align-items: center;
`;

const ErrorCount = styled.span`
  color: red;
`;

const SelectWrapper = styled.div`
  ${fullWidthCss};
  padding: 0 12px;
  > div {
    ${fullWidthCss};
  }
`;

const Select = styled(BaseSelect)`
  width: 100%;
  > div {
    width: 100%;
  }
`;

const getOptionValue = (option) => option.id;
const getOptionLabel = (option) => option.nameWithNamespace || option.name;

const processingQuery = gql`
  query ProcessingStatuses {
    processingFailures {
      error
      queueElement {
        projectId
        issueIid
      }
      config {
        url
        data
      }
    }
    processingProjects {
      projectId
      isProcessing
      isLoading
      meta {
        nameWithNamespace
      }
      completedCount
      failedCount
      totalCount
      currentMessage
      currentIssueIid
    }
  }
`;

const RemoveButton = ({ project }: *) => (
  <Mutation
    mutation={gql`mutation {
    clearMigrationProject(gitlabProjectId: "${project.projectId}") {
      success
    }
  }`}
    refetchQueries={['ProcessingStatuses']}
  >
    {(remove, { loading }) => (
      <Button appearance="danger" onClick={remove} isLoading={loading}>
        Remove
      </Button>
    )}
  </Mutation>
);

const renderProjectStatus = (project) => {
  if (project.isLoading) {
    return (
      <span>
        <span>Currently Loading and pre-processing issues from GitLab</span>
        <RemoveButton project={project} />
      </span>
    );
  }
  if (project.completedCount >= project.totalCount) {
    return <span>Processed</span>;
  }
  if (project.completedCount + project.failedCount >= project.totalCount) {
    return <span>Processed With Failures ({project.failedCount})</span>;
  }
  if (project.isProcessing) {
    return (
      <span>
        {project.currentIssueIid ? `Issue ${project.currentIssueIid}: ` : null}{' '}
        {project.currentMessage}
      </span>
    );
  }
  return (
    <span>
      <Link to={`/project/${project.projectId}`}>Prepare Migration</Link>{' '}
      <RemoveButton project={project} />
    </span>
  );
};

const renderProjectProgress = (project) => {
  let loadingFragment = null;
  let failureFragment = null;
  if (
    project.isLoading ||
    (project.isProcessing &&
      project.completedCount + project.failedCount < project.totalCount)
  ) {
    loadingFragment = (
      <Fragment>
        <Spinner />{' '}
      </Fragment>
    );
  }
  if (project.failedCount > 0) {
    failureFragment = (
      <Fragment>
        {' '}
        (<ErrorCount>{project.failedCount}</ErrorCount>)
      </Fragment>
    );
  }
  return (
    <span>
      {loadingFragment}
      {project.completedCount}
      {failureFragment} / {project.totalCount}
    </span>
  );
};

export default class Migrations extends Component {
  state = {};

  selectGitlabProject = (option) => {
    this.setState({
      gitlabProjectId: option.id
    });
  };

  startMigration = () => {
    const { gitlabProjectId } = this.state;
    const { history } = this.props;
    history.push(`/project/${gitlabProjectId}`);
  };

  render() {
    return (
      <Page>
        <GridColumn>
          <Grid>
            <Mutation
              mutation={gql`
                mutation RetryFailures {
                  retryAllFailures {
                    success
                  }
                }
              `}
            >
              {(startRetry, { loading }) => (
                <Button
                  appearance="primary"
                  isLoading={loading}
                  onClick={startRetry}
                >
                  Retry all failures
                </Button>
              )}
            </Mutation>
            <Query query={processingQuery} pollInterval={30000}>
              {({ loading, error, data = {}, stopPolling }) => {
                if (
                  error ||
                  !data.processingProjects ||
                  !data.processingProjects.find(
                    (project) =>
                      project.isLoading ||
                      (project.isProcessing &&
                        project.completedCount + project.failedCount <
                          project.totalCount)
                  )
                ) {
                  stopPolling();
                }
                return (
                  <DynamicTable
                    isFixedSize
                    caption={<h4>Processed and Processing Projects</h4>}
                    head={{
                      cells: [
                        {
                          key: 'name',
                          content: 'Project Name',
                          isSortable: true,
                          shouldTruncate: true
                        },
                        {
                          key: 'progress',
                          content: 'Progress',
                          isSortable: false
                        },
                        {
                          key: 'status',
                          content: '',
                          isSortable: false
                        }
                      ]
                    }}
                    rows={(data.processingProjects || []).map((project) => ({
                      key: project.projectId,
                      cells: [
                        {
                          key: 'name',
                          content: project.meta && project.meta.nameWithNamespace
                        },
                        {
                          key: 'progress',
                          content: renderProjectProgress(project)
                        },
                        {
                          key: 'status',
                          content: renderProjectStatus(project)
                        }
                      ]
                    }))}
                    isLoading={loading}
                  />
                );
              }}
            </Query>
          </Grid>
        </GridColumn>
        <h4>Start New Migration</h4>
        <Query
          query={gql`
            {
              gitlabProjects {
                id
                nameWithNamespace
              }
            }
          `}
        >
          {({ loading, error, data = {} }) =>
            error ? (
              <span>{error.toString()}</span>
            ) : (
              <Row>
                <SelectWrapper>
                  <Select
                    isLoading={loading}
                    options={data.gitlabProjects}
                    getOptionValue={getOptionValue}
                    getOptionLabel={getOptionLabel}
                    onChange={this.selectGitlabProject}
                  />
                </SelectWrapper>
                <Button
                  appearance="primary"
                  isDisabled={!this.state.gitlabProjectId}
                  onClick={this.startMigration}
                >
                  Migrate
                </Button>
              </Row>
            )
          }
        </Query>
      </Page>
    );
  }
}
