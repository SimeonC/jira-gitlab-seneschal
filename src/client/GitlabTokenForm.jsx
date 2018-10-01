// @flow
import React, { Component, createRef } from 'react';
import { Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import Form, {
  Field,
  FormHeader,
  FormSection,
  FormFooter
} from '@atlaskit/form';
import FieldText from '@atlaskit/field-text';
import Button from '@atlaskit/button';

type PropsType = {
  isSaving: boolean,
  onSubmit: (*) => boolean,
  response?: { success: boolean }
};

type StateType = {
  appUrl: string,
  token: string
};

class FormContent extends Component<PropsType, StateType> {
  formRef = createRef();

  state = {
    appUrl: '',
    token: ''
  };

  create = () => {
    this.props.onSubmit({
      variables: { appUrl: this.state.appUrl, token: this.state.token },
      update: (store, { data }) => {
        store.writeQuery({
          query: gql`
            {
              isSetup {
                success
              }
            }
          `,
          data: {
            isSetup: data.setGitlabCredentials
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
      <Form name="gitlab-auth" onSubmit={this.onSubmit} ref={this.formRef}>
        <FormHeader
          title="Gitlab Details"
          description="Please fill out the details for your gitlab instance to connect to"
        />

        <FormSection name="details">
          <Field
            label="Gitlab App Url"
            helperText="Enter the url of your gitlab instance"
            isRequired
          >
            <FieldText
              name="appUrl"
              id="appUrl"
              value=""
              onChange={this.fieldOnChange}
              required
            />
          </Field>
          <Field
            label="Gitlab API Token"
            helperText="Enter the API token generated from the gitlab user settings, this Token should have admin permissions"
            isRequired
          >
            <FieldText
              name="token"
              id="token"
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
      mutation SetGitlabCredentials($appUrl: String!, $token: String!) {
        setGitlabCredentials(appUrl: $appUrl, token: $token) {
          success
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
