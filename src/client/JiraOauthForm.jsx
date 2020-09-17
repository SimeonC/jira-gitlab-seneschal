// @flow
import React from 'react';
import { Mutation, Query } from 'react-apollo';
import gql from 'graphql-tag';
import Form, {
  Field,
  FormHeader,
  FormSection,
  FormFooter
} from '@atlaskit/form';
import TextField from '@atlaskit/textfield';
import Button from '@atlaskit/button';
import Spinner from '@atlaskit/spinner';
import Lozenge from '@atlaskit/lozenge';

type PropsType = {
  isSaving: boolean,
  onSubmit: (*) => boolean,
  response?: { status: 'connected' | 'disconnected' }
};

const FormContent = ({ isSaving, onSubmit, response }: PropsType) => {
  return (
    <Form
      name="dev-tools-auth"
      onSubmit={(formData) => {
        onSubmit({
          variables: formData,
          update: (store, { data }) => {
            store.writeQuery({
              query: gql`
                {
                  devToolsStatus {
                    status
                  }
                }
              `,
              data: {
                devToolsStatus: data.setDevToolsCredentials
              }
            });
          }
        });
      }}
    >
      {({ formProps }) => (
        <form {...formProps}>
          <FormHeader title="Jira Oauth2 DevTools details" />

          <Query
            query={gql`
              {
                devToolsStatus {
                  status
                }
              }
            `}
          >
            {({ loading, error, data = {} }) => {
              if (loading) {
                return <Spinner />;
              }
              if (error || !data || !data.devToolsStatus.status) {
                return null;
              }
              const { status } = data.devToolsStatus;
              return (
                <Lozenge
                  appearance={status === 'connected' ? 'success' : 'default'}
                >
                  {status}
                </Lozenge>
              );
            }}
          </Query>

          <p>
            To get the following ID and token go to OAuth Credentials and create
            a new ID and Token pair, make sure the permissions include
            "Development Information". The rest of the settings have no effect
            on the integration.
          </p>
          <FormSection name="details">
            <Field
              label="Client ID"
              isRequired
              name="clientId"
              id="clientId"
              defaultValue=""
            >
              {({ fieldProps }) => <TextField {...fieldProps} />}
            </Field>
            <Field
              label="Client Token"
              isRequired
              name="clientToken"
              id="clientToken"
              defaultValue=""
            >
              {({ fieldProps }) => <TextField {...fieldProps} />}
            </Field>
          </FormSection>
          <FormFooter actions={{}}>
            <Button
              type="submit"
              appearance="primary"
              disabled={isSaving}
              isLoading={isSaving}
            >
              Submit
            </Button>
          </FormFooter>
        </form>
      )}
    </Form>
  );
};

export default () => (
  <Mutation
    mutation={gql`
      mutation SetGitlabCredentials($clientId: String!, $clientToken: String!) {
        setDevToolsCredentials(clientId: $clientId, clientToken: $clientToken) {
          status
        }
      }
    `}
  >
    {(setCredentials, { data, loading, error }) => (
      <FormContent
        onSubmit={setCredentials}
        response={data}
        isSaving={loading}
        error={error}
      />
    )}
  </Mutation>
);
