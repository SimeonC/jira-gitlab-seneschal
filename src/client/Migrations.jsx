import React, { Component } from 'react';
import styled, { css } from 'styled-components';
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Link } from 'react-router-dom';

import Page, { Grid, GridColumn } from '@atlaskit/page';
import DynamicTable from '@atlaskit/dynamic-table';
import Spinner from '@atlaskit/spinner';
import Button from '@atlaskit/button';
import BaseSelect from '@atlaskit/select';

const fullWidthCss = css`
  display: flex;
  flex: 1 1 100%;
`;

const Row = styled.div`
  ${fullWidthCss};
  align-items: center;
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

// Step 1. Select Gitlab Project
// Step 2. Load Gitlab Project into file system
// Step 3. Select Jira Project
// Step 4. Load Jira IssueTypes, Versions, Components
// Step 5. Build Mapping (Must map all Milestones -> Versions or ignore)
// Step 6. Confirm and run transition

const getOptionValue = (option) => option.id;
const getOptionLabel = (option) => option.nameWithNamespace || option.name;

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
            <Query
              query={gql`
                {
                  processingProjects {
                    projectId
                    isProcessing
                    gitlabProjectName
                    completedCount
                    totalCount
                    currentMessage
                    currentIssueIid
                  }
                }
              `}
              pollInterval={1000}
            >
              {({ loading, error, data, stopPolling }) => {
                if (
                  !data.processingProjects ||
                  !data.processingProjects.find(
                    (project) =>
                      project.isProcessing &&
                      project.completedCount < project.totalCount
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
                          content: project.gitlabProjectName
                        },
                        {
                          key: 'progress',
                          content: (
                            <span>
                              {project.isProcessing &&
                              project.completedCount < project.totalCount ? (
                                <span>
                                  <Spinner />{' '}
                                </span>
                              ) : null}
                              {project.completedCount} / {project.totalCount}
                            </span>
                          )
                        },
                        {
                          key: 'status',
                          content:
                            project.completedCount >= project.totalCount ? (
                              <span>Processed</span>
                            ) : project.isProcessing ? (
                              <span>
                                {project.currentIssueIid
                                  ? `Issue ${project.currentIssueIid}: `
                                  : null}
                                {project.currentMessage}
                              </span>
                            ) : (
                              <Link to={`/project/${project.projectId}`}>
                                Prepare Migration
                              </Link>
                            )
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
          {({ loading, error, data }) =>
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
