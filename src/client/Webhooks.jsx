// @flow
import React, { Component } from 'react';
import styled, { css } from 'styled-components';
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { Link } from 'react-router-dom';
import startCase from 'lodash/startCase';

import Page, { Grid, GridColumn } from '@atlaskit/page';
import DynamicTable from '@atlaskit/dynamic-table';
import { Status } from '@atlaskit/status';
import Button from '@atlaskit/button';
import BaseSelect from '@atlaskit/select';
import type { WebhookProjectStatusEnumType } from '../server/apis/webhooks';

import WebhookSettings from './WebhookSettings';

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

const statusColor = (status: WebhookProjectStatusEnumType) => {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'healthy':
      return 'green';
    case 'sick':
      return 'red';
  }
};

// Step 1. Select Gitlab Project
// Step 2. Load Gitlab Project into file system
// Step 3. Select Jira Project
// Step 4. Load Jira IssueTypes, Versions, Components
// Step 5. Build Mapping (Must map all Milestones -> Versions or ignore)
// Step 6. Confirm and run transition

const webhooksQuery = gql`
  {
    webhooks {
      id
      name
      url
      status
    }
  }
`;

const getOptionValue = (option) => option.id;
const getOptionLabel = (option) => option.nameWithNamespace || option.name;

class Webhooks extends Component<
  { createWebhook: any, isSaving: boolean },
  { gitlabProjectId?: string }
> {
  state = {};

  selectGitlabProject = (option) => {
    this.setState({
      gitlabProjectId: option.id
    });
  };

  createWebhook = () => {
    const { gitlabProjectId } = this.state;
    const { createWebhook } = this.props;
    if (!gitlabProjectId) return;
    createWebhook({
      variables: {
        gitlabProjectId: `${gitlabProjectId}`
      },
      update: (store, { data: { createGitlabWebhooks } }) => {
        const cachedData = store.readQuery({
          query: webhooksQuery
        });
        const existingHook = cachedData.webhooks.find(
          ({ id }) => id === gitlabProjectId
        );
        if (existingHook) {
          const index = cachedData.webhooks.indexOf(existingHook);
          if (createGitlabWebhooks) {
            cachedData.webhooks.splice(index, 1, createGitlabWebhooks);
          } else {
            cachedData.webhooks.splice(index, 1);
          }
        } else if (createGitlabWebhooks) {
          cachedData.webhooks.push(createGitlabWebhooks);
        }
        store.writeQuery({
          query: webhooksQuery,
          data: cachedData
        });
      }
    });
  };

  render() {
    return (
      <Page>
        <GridColumn>
          <Grid>
            <Query query={webhooksQuery}>
              {({ loading, error, data }) => (
                <DynamicTable
                  isFixedSize
                  caption={<h4>Projects with webhooks</h4>}
                  head={{
                    cells: [
                      {
                        key: 'name',
                        content: 'Project Name',
                        isSortable: true,
                        shouldTruncate: true
                      },
                      {
                        key: 'status',
                        content: 'Status',
                        isSortable: false
                      }
                    ]
                  }}
                  rows={(data.webhooks || []).map((webhook) => ({
                    key: webhook.id,
                    cells: [
                      {
                        key: 'name',
                        content: (
                          <a href={webhook.url} target="_blank">
                            {webhook.name}
                          </a>
                        )
                      },
                      {
                        key: 'status',
                        content: (
                          <Status
                            text={startCase(webhook.status)}
                            color={statusColor(webhook.status)}
                          />
                        )
                      }
                    ]
                  }))}
                  isLoading={loading}
                />
              )}
            </Query>
          </Grid>
        </GridColumn>
        <h4>Webhook Settings</h4>
        <WebhookSettings />
        <h4>Create/Update Project Webhook</h4>
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
                  isLoading={this.props.isSaving}
                  onClick={this.createWebhook}
                >
                  Create Webhooks
                </Button>
              </Row>
            )
          }
        </Query>
      </Page>
    );
  }
}

export default () => (
  <Mutation
    mutation={gql`
      mutation CreateWebhook($gitlabProjectId: String!) {
        createGitlabWebhooks(gitlabProjectId: $gitlabProjectId) {
          id
          name
          url
          status
        }
      }
    `}
  >
    {(createWebhook, { loading, error }) => (
      <Webhooks
        createWebhook={createWebhook}
        isSaving={loading}
        error={error}
      />
    )}
  </Mutation>
);
