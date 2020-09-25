// @flow
import React, { Component, Fragment } from 'react';
import { Query, Mutation } from '@apollo/client/react/components';
import { gql } from '@apollo/client';
import styled from '@emotion/styled';
import Composer from 'react-composer';

import Form, {
  Field,
  FormHeader,
  FormSection,
  FormFooter,
  HelperMessage
} from '@atlaskit/form';
import TextField from '@atlaskit/textfield';
import Button from '@atlaskit/button/loading-button';
import Spinner from '@atlaskit/spinner';
import Select from '@atlaskit/select';
import { buildMeta, Status, statusSelectOptions } from './utils';
import sanitizeData from '../sanitizeData';

type StatusType = {
  id: string
};

const MetadataQuery = gql`
  query WebhookMetadata {
    getWebhookMetadata {
      transitionKeywords
      transitionMap {
        jiraProjectId
        jiraProjectKey
        mergeStatusIds
        openStatusIds
        closeStatusIds
      }
      defaultTransitionMap {
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

const StatusTableCell = styled.td`
  > *:not(:last-child) {
    margin-right: 6px;
  }
`;

const getProjectOptionValue = (option) => option.key;
const getProjectOptionLabel = (option) => `${option.key} - ${option.name}`;

class Transitions extends Component<
  {
    saveMetadata: any,
    upsertTransition: any,
    setDefaultTransition: any,
    data: *,
    jiraData: *,
    isSaving: boolean
  },
  {
    transitionKeywords?: string[],
    jiraProjectId?: string,
    jiraProjectKey?: string,
    newOpenStatuses?: StatusType[],
    newMergeStatuses?: StatusType[],
    newCloseStatuses?: StatusType[],
    newDefaultOpenStatuses?: StatusType[],
    newDefaultMergeStatuses?: StatusType[],
    newDefaultCloseStatuses?: StatusType[]
  }
> {
  state = {};

  selectJiraProject = (option) => {
    this.setState({
      jiraProjectKey: option.key,
      jiraProjectId: option.id
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

  selectDefaultOpenStatus = (options) => {
    this.setState({
      newDefaultOpenStatuses: options
    });
  };

  selectDefaultMergeStatus = (options) => {
    this.setState({
      newDefaultMergeStatuses: options
    });
  };

  selectDefaultCloseStatus = (options) => {
    this.setState({
      newDefaultCloseStatuses: options
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
      jiraProjectId,
      jiraProjectKey,
      newOpenStatuses = [],
      newMergeStatuses = [],
      newCloseStatuses = []
    } = this.state;
    const { upsertTransition } = this.props;
    if (!jiraProjectId) return;
    const newTransition = {
      jiraProjectId,
      jiraProjectKey,
      mergeStatusIds: newMergeStatuses.map(({ id }) => id),
      openStatusIds: newOpenStatuses.map(({ id }) => id),
      closeStatusIds: newCloseStatuses.map(({ id }) => id)
    };
    upsertTransition({
      variables: sanitizeData(newTransition)
    });
  };

  setDefaultTransition = () => {
    const {
      newDefaultOpenStatuses = [],
      newDefaultMergeStatuses = [],
      newDefaultCloseStatuses = []
    } = this.state;
    const { setDefaultTransition } = this.props;
    const newTransition = {
      mergeStatusIds: newDefaultMergeStatuses.map(({ id }) => id),
      openStatusIds: newDefaultOpenStatuses.map(({ id }) => id),
      closeStatusIds: newDefaultCloseStatuses.map(({ id }) => id)
    };
    setDefaultTransition({
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
    const {
      newDefaultOpenStatuses,
      newDefaultMergeStatuses,
      newDefaultCloseStatuses
    } = this.state;
    const statuses = jiraData.jiraStatuses;
    const {
      defaultTransitionMap: rawDefaultTransitionMap,
      transitionKeywords
    } = data.getWebhookMetadata;
    const transitionMap = [...data.getWebhookMetadata.transitionMap];
    const availableProjects = [];
    // There should only be one of these but it returns an array
    const defaultTransitionMap = rawDefaultTransitionMap.map(
      (transitionMap, index) =>
        buildMeta(
          { ...transitionMap, __meta: { id: index } },
          `Default Transitions`,
          statuses
        )
    );
    jiraData.jiraProjects.forEach((project) => {
      const map = transitionMap.find(
        ({ jiraProjectId }) => project.id === jiraProjectId
      );
      if (!map) {
        availableProjects.push(project);
      } else {
        transitionMap[transitionMap.indexOf(map)] = buildMeta(
          map,
          project.name,
          statuses
        );
      }
    });
    return (
      <div>
        <Form name="transition-keywords" onSubmit={() => {}}>
          {({ formProps }) => (
            <form {...formProps}>
              <FormHeader title="Transition Keywords" />
              <Field name="transitionKeywords" label="Transition Keywords">
                {() => (
                  <Fragment>
                    <TextField
                      placholder="Transition Keywords"
                      value={transitionKeywords.join(', ')}
                      onChange={this.setTransitionKeywords}
                    />
                    <HelperMessage>
                      These words will be used in conjuction with ticket IDs to
                      transition the ticket to the set state
                    </HelperMessage>
                  </Fragment>
                )}
              </Field>
              <Button
                appearance="primary"
                disabled={isSaving}
                isLoading={isSaving}
                onClick={this.saveTransitionKeywords}
              >
                Save
              </Button>
            </form>
          )}
        </Form>
        <Form
          name="set-default-transition"
          onSubmit={this.setDefaultTransition}
        >
          {({ formProps }) => (
            <form {...formProps}>
              <FormHeader title="Default Transition Map" />

              <FormSection name="details">
                <Field name="On Opened Status" label="On Opened Status">
                  {() => (
                    <Fragment>
                      <Select
                        options={statuses}
                        value={newDefaultOpenStatuses}
                        {...statusSelectOptions}
                        onChange={this.selectDefaultOpenStatus}
                      />
                      <HelperMessage>
                        The Jira status to attempt to transition to when opening
                        a merge request
                      </HelperMessage>
                    </Fragment>
                  )}
                </Field>
                <Field name="On Merged Status" label="On Merged Status">
                  {() => (
                    <Fragment>
                      <Select
                        options={statuses}
                        value={newDefaultMergeStatuses}
                        {...statusSelectOptions}
                        onChange={this.selectDefaultMergeStatus}
                      />
                      <HelperMessage>
                        The Jira status to attempt to transition to when merging
                        a merge request
                      </HelperMessage>
                    </Fragment>
                  )}
                </Field>
                <Field name="On Close Status" label="On Close Status">
                  {() => (
                    <Fragment>
                      <Select
                        options={statuses}
                        value={newDefaultCloseStatuses}
                        {...statusSelectOptions}
                        onChange={this.selectDefaultCloseStatus}
                      />
                      <HelperMessage>
                        The Jira status to attempt to transition to when closing
                        a merge request without merging
                      </HelperMessage>
                    </Fragment>
                  )}
                </Field>
              </FormSection>
              <FormFooter>
                <FormFooter actions={{}}>
                  <Button
                    type="submit"
                    appearance="primary"
                    disabled={isSaving || !this.state.jiraProjectId}
                    isLoading={isSaving}
                  >
                    Set Default Transition Map
                  </Button>
                </FormFooter>
              </FormFooter>
            </form>
          )}
        </Form>
        <Form name="create-transition" onSubmit={this.createTransition}>
          {({ formProps }) => (
            <form {...formProps}>
              <FormHeader title="Transition Maps" />

              <FormSection name="details">
                <Field
                  name="Jira Project"
                  label="Jira Project"
                  description="If a merge request is opened/merged/closed with a commit of the format `<Transition Keyword> <Jira issue key>` it will attempt to transition the issue to the relevant Status"
                >
                  {() => (
                    <Select
                      options={availableProjects}
                      getOptionValue={getProjectOptionValue}
                      getOptionLabel={getProjectOptionLabel}
                      onChange={this.selectJiraProject}
                    />
                  )}
                </Field>
                <Field name="On Opened Status" label="On Opened Status">
                  {() => (
                    <Fragment>
                      <Select
                        options={statuses}
                        {...statusSelectOptions}
                        onChange={this.selectOpenStatus}
                      />
                      <HelperMessage>
                        The Jira status to attempt to transition to when opening
                        a merge request
                      </HelperMessage>
                    </Fragment>
                  )}
                </Field>
                <Field name="On Merged Status" label="On Merged Status">
                  {() => (
                    <Fragment>
                      <Select
                        options={statuses}
                        {...statusSelectOptions}
                        onChange={this.selectMergeStatus}
                      />
                      <HelperMessage>
                        The Jira status to attempt to transition to when merging
                        a merge request
                      </HelperMessage>
                    </Fragment>
                  )}
                </Field>
                <Field name="On Close Status" label="On Close Status">
                  {() => (
                    <Fragment>
                      <Select
                        options={statuses}
                        {...statusSelectOptions}
                        onChange={this.selectCloseStatus}
                      />
                      <HelperMessage>
                        The Jira status to attempt to transition to when closing
                        a merge request without merging
                      </HelperMessage>
                    </Fragment>
                  )}
                </Field>
              </FormSection>
              <FormFooter>
                <FormFooter actions={{}}>
                  <Button
                    type="submit"
                    appearance="primary"
                    disabled={isSaving || !this.state.jiraProjectId}
                    isLoading={isSaving}
                  >
                    Create New Transition Map
                  </Button>
                </FormFooter>
              </FormFooter>
            </form>
          )}
        </Form>
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
            {defaultTransitionMap.map((transitionMap) => (
              <tr key={transitionMap.__meta.id}>
                <td>{transitionMap.__meta.name}</td>
                {['open', 'merge', 'close'].map((key) => (
                  <StatusTableCell key={key}>
                    {transitionMap.__meta[`${key}Statuses`].map(
                      ({ name, color }) => (
                        <Status key={name} text={name} color={color} />
                      )
                    )}
                  </StatusTableCell>
                ))}
                <td />
              </tr>
            ))}
            {transitionMap.map((transitionMap) => (
              <Mutation
                key={transitionMap.jiraProjectId}
                mutation={gql`
                  mutation DeleteTransitionMap($jiraProjectId: String!) {
                    deleteWebhookTransitionMap(jiraProjectId: $jiraProjectId) {
                      success
                    }
                  }
                `}
                variables={{ jiraProjectId: transitionMap.jiraProjectId }}
                refetchQueries={['WebhookMetadata']}
              >
                {(deleteTransitionMap, { loading: isDeletingTransition }) => (
                  <tr>
                    <td>
                      {transitionMap.__meta ? (
                        transitionMap.__meta.name
                      ) : (
                        <span>
                          Key: <b>{transitionMap.jiraProjectKey}</b>
                        </span>
                      )}
                    </td>
                    {!transitionMap.__meta ? (
                      <td colSpan="3">
                        Project may have been renamed or deleted, please
                        re-create
                      </td>
                    ) : (
                      ['open', 'merge', 'close'].map((key) => (
                        <StatusTableCell key={key}>
                          {transitionMap.__meta[`${key}Statuses`].map(
                            ({ name, color }) => (
                              <Status key={name} text={name} color={color} />
                            )
                          )}
                        </StatusTableCell>
                      ))
                    )}
                    <td>
                      <Button
                        appearance="danger"
                        onClick={() => deleteTransitionMap()}
                        isLoading={isDeletingTransition}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                )}
              </Mutation>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

export default () => (
  <Composer
    components={[
      ({ render }: *) => (
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
          {(...args) => render(args)}
        </Mutation>
      ),
      ({ render }: *) => (
        <Mutation
          mutation={gql`
            mutation UpsertTransition(
              $jiraProjectKey: String!
              $jiraProjectId: String!
              $openStatusIds: [String!]!
              $mergeStatusIds: [String!]!
              $closeStatusIds: [String!]!
            ) {
              upsertWebhookTransitionMap(
                jiraProjectId: $jiraProjectId
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
          {(...args) => render(args)}
        </Mutation>
      ),
      ({ render }: *) => (
        <Mutation
          mutation={gql`
            mutation SetDefaultTransition(
              $openStatusIds: [String!]!
              $mergeStatusIds: [String!]!
              $closeStatusIds: [String!]!
            ) {
              setDefaultWebhookTransition(
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
          {(...args) => render(args)}
        </Mutation>
      ),
      ({ render }: *) => (
        <Query query={JiraQuery}>{(data) => render(data)}</Query>
      ),
      ({ render }: *) => (
        <Query query={MetadataQuery}>{(data) => render(data)}</Query>
      )
    ]}
  >
    {([
      [saveMetadata, { loading: isSaving, error: saveError }],
      [
        upsertTransitionMap,
        { loading: isSavingTransition, error: saveTransitionError }
      ],
      [
        setDefaultTransition,
        { loading: isSavingDefaultTransition, error: setDefaultTransitionError }
      ],
      { data: jiraData = {}, loading: jiraLoading, error: jiraError },
      { data = {}, loading, error }
    ]) => {
      if (loading || jiraLoading) {
        return <Spinner />;
      }
      if (error || jiraError) {
        console.error(error || jiraError);
        return 'Error Happened';
      }
      return (
        <Transitions
          saveMetadata={saveMetadata}
          upsertTransition={upsertTransitionMap}
          setDefaultTransition={setDefaultTransition}
          data={data}
          jiraData={jiraData}
          isSaving={isSaving || isSavingTransition || isSavingDefaultTransition}
          error={saveError || saveTransitionError || setDefaultTransitionError}
        />
      );
    }}
  </Composer>
);
