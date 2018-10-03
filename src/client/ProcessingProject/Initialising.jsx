import React, { Component } from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';
import { Redirect } from 'react-router-dom';
import Spinner from '@atlaskit/spinner';

export default class Initialising extends Component {
  render() {
    return (
      <Query
        query={gql`
          query {
            processingProject(gitlabProjectId: "${
              this.props.gitlabProjectId
            }") {
              isLoading
            }
          }
        `}
        pollInterval={2000}
      >
        {({ data, loading, error }) => {
          if (
            loading ||
            !data.processingProject ||
            data.processingProject.isLoading
          ) {
            return (
              <div>
                Currently Loading and processing project issues <Spinner />
              </div>
            );
          }
          return <Redirect to="mapping" />;
        }}
      </Query>
    );
  }
}
