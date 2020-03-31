// @flow
import React, { Component, createRef } from 'react';
import { Mutation, Query } from 'react-apollo';
import gql from 'graphql-tag';
import Form, {
  Field,
  FormHeader,
  FormSection,
  FormFooter
} from '@atlaskit/form';
import FieldText from '@atlaskit/field-text';
import Button from '@atlaskit/button';
import Spinner from '@atlaskit/spinner';
import Lozenge from '@atlaskit/lozenge';

type PropsType = {
  isSaving: boolean,
  onSubmit: (*) => boolean,
  response?: { status: 'connected' | 'disconnected' }
};

type StateType = {
  clientId: string,
  clientToken: string
};

class FormContent extends Component<PropsType, StateType> {
  formRef = createRef();

  state = {
    clientId: '',
    clientToken: ''
  };

  create = () => {
    this.props.onSubmit({
      variables: {
        clientId: this.state.clientId,
        clientToken: this.state.clientToken
      },
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
  };

  fieldOnChange = (event: SyntheticEvent<HTMLInputElement>) => {
    this.setState({
      [event.currentTarget.name]: event.currentTarget.value
    });
  };

  onSubmit = () => {
    if (this.formRef && this.formRef.current) {
      const validationResult = this.formRef.current.validate();
      if (!validationResult.isInvalid) {
        this.create();
      }
    }
  };

  render() {
    const { isSaving } = this.props;
    return (
      <Form name="dev-tools-auth" onSubmit={this.onSubmit} ref={this.formRef}>
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
          To get the following ID and token go to OAuth Credentials and create a
          new ID and Token pair, make sure the permissions include "Development
          Information". The rest of the settings have no effect on the
          integration.
        </p>
        <FormSection name="details">
          <Field label="Client ID" isRequired>
            <FieldText
              name="clientId"
              id="clientId"
              value=""
              onChange={this.fieldOnChange}
              required
            />
          </Field>
          <Field label="Client Token" isRequired>
            <FieldText
              name="clientToken"
              id="clientToken"
              value=""
              onChange={this.fieldOnChange}
              required
            />
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
      </Form>
    );
  }
}

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
