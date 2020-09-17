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
import CheckIcon from '@atlaskit/icon/glyph/check-circle';

type PropsType = {
  isSaving: boolean,
  onSubmit: (*) => boolean,
  response?: { success?: boolean }
};

const FormContent = ({ isSaving, onSubmit, response }: PropsType) => {
  return (
    <Form
      name="gitlab-auth"
      onSubmit={(formData) => {
        onSubmit({
          variables: formData,
          update: (store, { data }) => {
            store.writeQuery({
              query: gql`
                {
                  isSetup {
                    success
                    currentUrl
                  }
                }
              `,
              data: {
                isSetup: data.setGitlabCredentials,
                currentUrl: formData.appUrl
              }
            });
          }
        });
      }}
    >
      {({ formProps }) => (
        <form {...formProps}>
          <FormHeader
            title="Gitlab Details"
            description="Please fill out the details for your gitlab instance to connect to"
          />

          <Query
            query={gql`
              {
                isSetup {
                  success
                  currentUrl
                  username
                }
              }
            `}
          >
            {({ loading, error, data = {} }) => {
              if (loading) {
                return <Spinner />;
              }
              if (error || !data || !data.isSetup.success) {
                return null;
              }
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <CheckIcon primaryColor="green" />
                  <div style={{ margin: '0 6px' }}>
                    Connected
                    <br />
                    <strong>Site: </strong>
                    {data.isSetup.currentUrl}
                    <br />
                    <strong>Username: </strong>
                    {data.isSetup.username}
                    <br />
                  </div>
                </div>
              );
            }}
          </Query>

          <FormSection name="details">
            <Field
              name="appUrl"
              label="Gitlab App Url"
              helperText="Enter the url of your gitlab instance"
              defaultValue=""
              isRequired
            >
              {({ fieldProps }) => <TextField {...fieldProps} />}
            </Field>
            <Field
              name="token"
              label="Gitlab API Token"
              helperText="Enter the API token generated from the gitlab user settings, this Token should have admin permissions"
              defaultValue=""
              isRequired
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
      mutation SetGitlabCredentials($appUrl: String!, $token: String!) {
        setGitlabCredentials(appUrl: $appUrl, token: $token) {
          success
        }
      }
    `}
  >
    {(setCredentials, { data = {}, loading, error }) => (
      <FormContent
        onSubmit={setCredentials}
        response={data}
        isSaving={loading}
        error={error}
      />
    )}
  </Mutation>
);
