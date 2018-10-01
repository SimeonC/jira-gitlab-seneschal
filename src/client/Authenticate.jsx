// @flow
import React, { Component } from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import Spinner from '@atlaskit/spinner';

import GitlabTokenForm from './GitlabTokenForm';

type PropsType = {
  children: *
};

export default class Authenticate extends Component<PropsType> {
  render() {
    const { children } = this.props;
    return (
      <Query
        query={gql`
          {
            isSetup {
              success
            }
          }
        `}
      >
        {({ loading, error, data }) => {
          if (loading) {
            return <Spinner />;
          }
          if (error || !data || !data.isSetup.success) {
            return <GitlabTokenForm />;
          }
          return children;
        }}
      </Query>
    );
  }
}
