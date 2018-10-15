// @flow
import React, { Component } from 'react';
import { Query, Mutation } from 'react-apollo';
import gql from 'graphql-tag';

import Form, {
  Field,
  FormHeader,
  FormSection,
  FormFooter
} from '@atlaskit/form';
import FieldText from '@atlaskit/field-text';
import Button from '@atlaskit/button';
import { Status } from '@atlaskit/status';
import Spinner from '@atlaskit/spinner';
import Select from '@atlaskit/select';
import sanitizeData from './sanitizeData';

type StatusType = {
  id: string
};

const MetadataQuery = gql`
  query WebhookMetadata {
    getWebhookMetadata {
      transitionKeywords
      transitionMap {
        jiraProjectKey
        mergeStatusIds
        openStatusIds
        closeStatusIds
      }
    }
  }
`;
const JiraQuery = gql`
  query JiraQuery {
    jiraProjects {
      id
      key
      name
    }
    jiraStatuses {
      iconUrl
      name
      id
      statusCategory {
        colorName
      }
    }
  }
`;

const getProjectOptionValue = (option) => option.key;
const getProjectOptionLabel = (option) => `${option.key} - ${option.name}`;

const getStatusOptionValue = (option) => option.id;
const getStatusOptionLabel = (option) => (
  <Status text={option.name || ''} color={option.statusCategory.colorName} />
);

class WebhookSettings extends Component<
  {
    saveMetadata: any,
    createTransition: any,
    data: *,
    jiraData: *,
    isSaving: boolean
  },
  {
    transitionKeywords?: string[],
    jiraProjectKey?: string,
    newOpenStatuses?: StatusType[],
    newMergeStatuses?: StatusType[],
    newCloseStatuses?: StatusType[]
  }
> {
  state = {};

  selectJiraProject = (option) => {
    this.setState({
      jiraProjectKey: option.key
    });
  };

  selectOpenStatus = (options) => {
    this.setState({
      newOpenStatuses: options
    });
  };

  selectMergeStatus = (options) => {
    this.setState({
      newMergeStatuses: options
    });
  };

  selectCloseStatus = (options) => {
    this.setState({
      newCloseStatuses: options
    });
  };

  setTransitionKeywords = (event: *) => {
    this.setState({
      transitionKeywords: event.currentTarget.value
        .split(',')
        .map((val) => val.trim())
    });
  };

  createTransition = () => {
    const {
      jiraProjectKey,
      newOpenStatuses = [],
      newMergeStatuses = [],
      newCloseStatuses = []
    } = this.state;
    const { createTransition } = this.props;
    if (!jiraProjectKey) return;
    const newTransition = {
      jiraProjectKey,
      mergeStatusIds: newMergeStatuses.map(({ id }) => id),
      openStatusIds: newOpenStatuses.map(({ id }) => id),
      closeStatusIds: newCloseStatuses.map(({ id }) => id)
    };
    createTransition({
      variables: sanitizeData(newTransition)
    });
  };

  saveTransitionKeywords = () => {
    const { transitionKeywords } = this.state;
    const { saveMetadata } = this.props;
    saveMetadata({
      variables: {
        transitionKeywords
      }
    });
  };

  render() {
    const { data, jiraData, isSaving } = this.props;
    const projects = jiraData.jiraProjects;
    const statuses = jiraData.jiraStatuses;
    const { transitionMap, transitionKeywords } = data.getWebhookMetadata;
    const availableProjects = [];
    projects.forEach((project) => {
      const map = transitionMap.find(
        ({ jiraProjectKey }) => project.key === jiraProjectKey
      );
      if (!map) {
        availableProjects.push(project);
      } else {
        map.__meta = map.__meta || {};
        map.__meta.name = project.name;
        ['open', 'close', 'merge'].forEach((statusKey) => {
          map.__meta[`${statusKey}Statuses`] =
            map.__meta[`${statusKey}Statuses`] || [];
          const idKey = `${statusKey}StatusIds`;
          if (map[idKey]) {
            map[idKey].forEach((statusId) => {
              const status = statuses.find(({ id }) => statusId === id);
              if (status) {
                map.__meta[`${statusKey}Statuses`].push({
                  name: status.name,
                  color: status.statusCategory.colorName
                });
              }
            });
          }
        });
      }
    });
    return (
      <div>
        <div>
          <FieldText
            label="Transition Keywords"
            value={transitionKeywords.join(', ')}
            onChange={this.setTransitionKeywords}
            shouldFitContainer
          />
          <Button
            appearance="primary"
            disabled={isSaving}
            isLoading={isSaving}
            onClick={this.saveTransitionKeywords}
          >
            Save
          </Button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>On Open Status</th>
              <th>On Merge Status</th>
              <th>On Close Status</th>
            </tr>
          </thead>
          <tbody>
            {transitionMap.map((transitionMap) => (
              <tr key={transitionMap.jiraProjectKey}>
                <td>{transitionMap.__meta.name}</td>
                {['open', 'merge', 'close'].map((key) => (
                  <td key={key}>
                    {transitionMap.__meta[`${key}Statuses`].map(
                      ({ name, color }) => (
                        <Status key={name} text={name} color={color} />
                      )
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <Form name="create-transition" onSubmit={this.createTransition}>
          <FormHeader title="Add New Transition Map" />

          <FormSection name="details">
            <Field
              label="Jira Project"
              description="If a merge request is opened/merged/closed with a commit of the format `<Transition Keyword> <Jira issue key>` it will attempt to transition the issue to the relevant Status"
            >
              <Select
                options={availableProjects}
                getOptionValue={getProjectOptionValue}
                getOptionLabel={getProjectOptionLabel}
                onChange={this.selectJiraProject}
              />
            </Field>
            <Field
              label="On Opened Status"
              helperText="The Jira status to attempt to transition to when opening a merge request"
            >
              <Select
                options={statuses}
                isMulti
                getOptionValue={getStatusOptionValue}
                getOptionLabel={getStatusOptionLabel}
                onChange={this.selectOpenStatus}
              />
            </Field>
            <Field
              label="On Merged Status"
              helperText="The Jira status to attempt to transition to when merging a merge request"
            >
              <Select
                options={statuses}
                isMulti
                getOptionValue={getStatusOptionValue}
                getOptionLabel={getStatusOptionLabel}
                onChange={this.selectMergeStatus}
              />
            </Field>
            <Field
              label="On Close Status"
              helperText="The Jira status to attempt to transition to when closing a merge request without merging"
            >
              <Select
                options={statuses}
                isMulti
                getOptionValue={getStatusOptionValue}
                getOptionLabel={getStatusOptionLabel}
                onChange={this.selectCloseStatus}
              />
            </Field>
          </FormSection>
          <FormFooter>
            <FormFooter actions={{}}>
              <Button
                type="submit"
                appearance="primary"
                disabled={isSaving || !this.state.jiraProjectKey}
                isLoading={isSaving}
              >
                Create New Transition Map
              </Button>
            </FormFooter>
          </FormFooter>
        </Form>
        <p>{JSON.stringify(this.state)}</p>
      </div>
    );
  }
}

export default () => (
  <Mutation
    mutation={gql`
      mutation SetMetadata($transitionKeywords: [String!]) {
        setWebhookMetadata(transitionKeywords: $transitionKeywords) {
          success
        }
      }
    `}
    refetchQueries={['WebhookMetadata']}
  >
    {(saveMetadata, { loading: isSaving, error: saveError }) => (
      <Mutation
        mutation={gql`
          mutation SaveTransition(
            $jiraProjectKey: String!
            $openStatusIds: [String!]!
            $mergeStatusIds: [String!]!
            $closeStatusIds: [String!]!
          ) {
            upsertWebhookTransitionMap(
              jiraProjectKey: $jiraProjectKey
              openStatusIds: $openStatusIds
              closeStatusIds: $closeStatusIds
              mergeStatusIds: $mergeStatusIds
            ) {
              success
            }
          }
        `}
        refetchQueries={['WebhookMetadata']}
      >
        {(
          createTransition,
          { loading: isSavingTransition, error: saveTransitionError }
        ) => (
          <Query query={JiraQuery}>
            {({ data: jiraData, loading: jiraLoading, error: jiraError }) => (
              <Query query={MetadataQuery}>
                {({ data, loading, error }) => {
                  if (loading || jiraLoading) {
                    return <Spinner />;
                  }
                  if (error || jiraError) {
                    console.error(error || jiraError);
                    return 'Error Happened';
                  }
                  return (
                    <WebhookSettings
                      saveMetadata={saveMetadata}
                      createTransition={createTransition}
                      data={data}
                      jiraData={jiraData}
                      isSaving={isSaving || isSavingTransition}
                      error={saveError || saveTransitionError}
                    />
                  );
                }}
              </Query>
            )}
          </Query>
        )}
      </Mutation>
    )}
  </Mutation>
);
