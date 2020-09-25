import React, { useMemo, useState, useEffect, Fragment } from 'react';
import ReactDOM from 'react-dom';
import startCase from 'lodash/startCase';
import { useLazyQuery, useQuery, useMutation, gql } from '@apollo/client';
import Spinner from '@atlaskit/spinner';
import AppWrapper from './AppWrapper';
import sanitizeData from './sanitizeData';
import { buildMeta, Status, statusSelectOptions } from './Webhooks/utils';
import Form, {
  Field,
  FormFooter,
  FormHeader,
  FormSection,
  HelperMessage
} from '@atlaskit/form';
import Select from '@atlaskit/select';
import Button from '@atlaskit/button/loading-button';

const App = () => {
  const [loadData, { data: rawData, loading }] = useLazyQuery(gql`
    query ProjectWebhookTransitionMap($projectId: String!) {
      jiraProjects(jiraProjectId: $projectId) {
        id
        key
        name
      }
      jiraIssueTypes(projectId: $projectId) {
        id
        name
        iconUrl
        statuses {
          iconUrl
          name
          id
          statusCategory {
            colorName
          }
        }
      }
      getProjectWebhookTransitionMap(jiraProjectId: $projectId) {
        jiraProjectId
        jiraProjectKey
        mergeStatusIds
        openStatusIds
        closeStatusIds
      }
    }
  `);
  const { data: rawDefaultData, loading: isDefaultDataLoading } = useQuery(gql`
    query DefaultTransitionMap {
      getWebhookMetadata {
        defaultTransitionMap {
          mergeStatusIds
          openStatusIds
          closeStatusIds
        }
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
  `);
  const [saveTransitions, { loading: isSaving }] = useMutation(
    gql`
      mutation SaveProjecteWebhookTransitionMap(
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
    `
  );

  const defaultTransitionMapData = useMemo(() => {
    if (!rawDefaultData) return undefined;
    return rawDefaultData.getWebhookMetadata.defaultTransitionMap.map(
      (transitionMap, index) =>
        buildMeta(
          { ...transitionMap, __meta: { id: index } },
          'Default Transitions',
          rawDefaultData.jiraStatuses
        )
    )[0];
  }, [rawDefaultData]);

  const [newOpenStatuses, setNewOpenStatuses] = useState([]);
  const [newMergeStatuses, setNewMergeStatuses] = useState([]);
  const [newCloseStatuses, setNewCloseStatuses] = useState([]);

  const data = useMemo(() => {
    if (!rawData || !rawData.jiraProjects.length) return undefined;
    const allStatuses = [];
    const groupedStatuses = [];
    rawData.jiraIssueTypes.forEach(({ id, name, iconUrl, statuses }) => {
      const uniqueStatuses = [];
      const duplicatedStatuses = [];
      statuses.forEach((status) => {
        if (
          allStatuses.find(({ id: allStatusId }) => allStatusId === status.id)
        ) {
          duplicatedStatuses.push(status);
        } else {
          allStatuses.push(status);
          uniqueStatuses.push(status);
        }
      });
      if (duplicatedStatuses.length) {
        const foundDuplicateGroups = [];
        duplicatedStatuses.forEach((status) => {
          const group = groupedStatuses.find(
            ({ options }) => !!options.find((option) => option.id === status.id)
          );
          if (foundDuplicateGroups.indexOf(group) === -1) {
            foundDuplicateGroups.push(group);
          }
        });
        if (foundDuplicateGroups.length === 1) {
          foundDuplicateGroups[0].issueTypes.push({ id, name, iconUrl });
        } else {
          groupedStatuses.push({
            issueTypes: [{ id, name, iconUrl }],
            options: statuses
          });
          return;
        }
      }
      if (uniqueStatuses.length) {
        groupedStatuses.push({
          issueTypes: [{ id, name, iconUrl }],
          options: uniqueStatuses
        });
      }
    });

    return {
      transitionMap: buildMeta(
        rawData.getProjectWebhookTransitionMap,
        rawData.jiraProjects[0].name,
        allStatuses
      ),
      allStatuses,
      statuses: groupedStatuses
    };
  }, [rawData]);
  useEffect(() => {
    if (!rawData) return;
    function updateStatusValues(setter, ids, statuses) {
      setter(ids.map((id) => statuses.find((status) => status.id === id)));
    }
    updateStatusValues(
      setNewOpenStatuses,
      rawData.getProjectWebhookTransitionMap.openStatusIds,
      data.allStatuses
    );
    updateStatusValues(
      setNewMergeStatuses,
      rawData.getProjectWebhookTransitionMap.mergeStatusIds,
      data.allStatuses
    );
    updateStatusValues(
      setNewCloseStatuses,
      rawData.getProjectWebhookTransitionMap.closeStatusIds,
      data.allStatuses
    );
  }, [rawData, data]);

  useEffect(() => {
    window.AP.context.getContext((response) => {
      loadData({ variables: { projectId: response.jira.project.id } });
    });
  }, []);

  if (!data || loading) return <Spinner />;
  const { transitionMap, statuses } = data;
  let fallbackDefaultTransitionMap = <Spinner />;
  if (!isDefaultDataLoading && defaultTransitionMapData) {
    fallbackDefaultTransitionMap = ['open', 'merge', 'close'].map((key) => (
      <div key={key}>
        <p style={{ marginTop: 12 }}>
          On {startCase(key)} MR status transition list
        </p>
        <p>
          {defaultTransitionMapData.__meta[`${key}Statuses`].map(
            ({ name, color }) => (
              <Status key={name} text={name} color={color} />
            )
          )}
        </p>
      </div>
    ));
  }
  return (
    <Form
      name="set-default-transition"
      onSubmit={() => {
        saveTransitions({
          variables: sanitizeData({
            jiraProjectId: rawData.jiraProjects[0].id,
            jiraProjectKey: rawData.jiraProjects[0].key,
            mergeStatusIds: newMergeStatuses.map(({ id }) => id),
            openStatusIds: newOpenStatuses.map(({ id }) => id),
            closeStatusIds: newCloseStatuses.map(({ id }) => id)
          })
        });
      }}
    >
      {({ formProps }) => (
        <form {...formProps}>
          <FormHeader title="Gitlab Transition Map" />

          <h3>Fallback Default Transition Map</h3>
          {fallbackDefaultTransitionMap}

          <FormSection name="details">
            <Field name="On Opened Status" label="On Opened Status">
              {() => (
                <Fragment>
                  <Select
                    options={statuses}
                    value={newOpenStatuses}
                    {...statusSelectOptions}
                    onChange={(options) => {
                      if (options === newOpenStatuses) return;
                      setNewOpenStatuses(options);
                    }}
                  />
                  <HelperMessage>
                    The Jira status to attempt to transition to when opening a
                    merge request
                  </HelperMessage>
                </Fragment>
              )}
            </Field>
            <Field name="On Merged Status" label="On Merged Status">
              {() => (
                <Fragment>
                  <Select
                    options={statuses}
                    value={newMergeStatuses}
                    {...statusSelectOptions}
                    onChange={(options) => {
                      if (options === newMergeStatuses) return;
                      setNewMergeStatuses(options);
                    }}
                  />
                  <HelperMessage>
                    The Jira status to attempt to transition to when merging a
                    merge request
                  </HelperMessage>
                </Fragment>
              )}
            </Field>
            <Field name="On Close Status" label="On Close Status">
              {() => (
                <Fragment>
                  <Select
                    options={statuses}
                    value={newCloseStatuses}
                    {...statusSelectOptions}
                    onChange={(options) => {
                      if (options === newCloseStatuses) return;
                      setNewCloseStatuses(options);
                    }}
                  />
                  <HelperMessage>
                    The Jira status to attempt to transition to when closing a
                    merge request without merging
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
                disabled={isSaving}
                isLoading={isSaving}
              >
                Save
              </Button>
            </FormFooter>
          </FormFooter>
        </form>
      )}
    </Form>
  );
};

ReactDOM.render(
  <AppWrapper
    invalidSetupChildren={
      <div>
        Please contact your atlassian administrator to configure the application
      </div>
    }
  >
    <App />
  </AppWrapper>,
  document.getElementById('root')
);
