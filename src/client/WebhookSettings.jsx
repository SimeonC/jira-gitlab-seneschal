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

const metadataQuery = gql`
  {
    getWebhookMetadata {
      transitionKeywords
      transitionMap {
        jiraProjectKey
        transitionStatusIds {
          mergeId
          openId
          closeId
        }
      }
    }
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
  { saveMetadata: any, data: *, isSaving: boolean },
  {
    transitionKeywords?: string[],
    jiraProjectKey?: string,
    newOpenStatus?: *,
    newMergeStatus?: *,
    newCloseStatus?: *
  }
> {
  state = {};

  selectJiraProject = (option) => {
    this.setState({
      jiraProjectKey: option.key
    });
  };

  selectOpenStatus = (option) => {
    this.setState({
      newOpenStatus: option
    });
  };

  selectMergeStatus = (option) => {
    this.setState({
      newMergeStatus: option
    });
  };

  selectCloseStatus = (option) => {
    this.setState({
      newCloseStatus: option
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
      newOpenStatus = {},
      newMergeStatus = {},
      newCloseStatus = {}
    } = this.state;
    const { saveMetadata } = this.props;
    if (!jiraProjectKey) return;
    const metadata = this.props.data.getWebhookMetadata;
    metadata.transitionMap.push({
      jiraProjectKey,
      transitionStatusIds: {
        mergeId: newMergeStatus.id,
        openId: newOpenStatus.id,
        closeId: newCloseStatus.id
      }
    });
    saveMetadata({
      variables: {
        metadata: sanitizeData(metadata)
      },
      update: (store, { data: { setWebhookMetadata } }) => {
        const originalData = store.readQuery({
          query: metadataQuery
        });
        store.writeQuery({
          query: metadataQuery,
          data: {
            ...originalData,
            getWebhookMetadata: setWebhookMetadata
          }
        });
      }
    });
  };

  saveTransitionKeywords = () => {
    const { transitionKeywords } = this.state;
    const { saveMetadata } = this.props;
    const metadata = this.props.data.getWebhookMetadata;
    metadata.transitionKeywords = transitionKeywords;
    saveMetadata({
      variables: {
        metadata: sanitizeData(metadata)
      },
      update: (store, { data: { setWebhookMetadata } }) => {
        const originalData = store.readQuery({
          query: metadataQuery
        });
        store.writeQuery({
          query: metadataQuery,
          data: {
            ...originalData,
            getWebhookMetadata: setWebhookMetadata
          }
        });
      }
    });
  };

  render() {
    const { data, isSaving } = this.props;
    const projects = data.jiraProjects;
    const statuses = data.jiraStatuses;
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
          const idKey = `${statusKey}Id`;
          if (map.transitionStatusIds[idKey]) {
            const status = statuses.find(
              ({ id }) => map.transitionStatusIds[idKey] === id
            );
            if (status) {
              map.__meta[`${statusKey}Name`] = status.name;
              map.__meta[`${statusKey}Color`] = status.statusCategory.colorName;
            }
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
                <td>
                  <Status
                    text={transitionMap.__meta.openName}
                    color={transitionMap.__meta.openColor}
                  />
                </td>
                <td>
                  <Status
                    text={transitionMap.__meta.mergeName}
                    color={transitionMap.__meta.mergeColor}
                  />
                </td>
                <td>
                  <Status
                    text={transitionMap.__meta.closeName}
                    color={transitionMap.__meta.closeColor}
                  />
                </td>
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
      mutation SetMetadata($metadata: WebhookMetadataInput!) {
        setWebhookMetadata(metadata: $metadata) {
          transitionKeywords
          transitionMap {
            jiraProjectKey
            transitionStatusIds {
              mergeId
              openId
              closeId
            }
          }
        }
      }
    `}
  >
    {(saveMetadata, { loading: isSaving, error: saveError }) => (
      <Query query={metadataQuery}>
        {({ data, loading, error }) => {
          if (loading) {
            return <Spinner />;
          }
          if (error) {
            console.error(error);
            return 'Error Happened';
          }
          return (
            <WebhookSettings
              saveMetadata={saveMetadata}
              data={data}
              isSaving={isSaving}
              error={saveError}
            />
          );
        }}
      </Query>
    )}
  </Mutation>
);
