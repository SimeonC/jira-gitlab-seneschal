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
              completedCount
              failedCount
              totalCount
            }
          }
        `}
        pollInterval={2500}
      >
        {({ data, loading, error }) => {
          if (
            loading ||
            !data.processingProject ||
            data.processingProject.isLoading
          ) {
            let progress = null;
            if (data.processingProject) {
              progress = (
                <span>
                  {data.processingProject.completedCount +
                    data.processingProject.failedCount}{' '}
                  / {data.processingProject.totalCount}{' '}
                </span>
              );
            }
            return (
              <div>
                Currently Loading and processing project issues, {progress}
                <Spinner />
              </div>
            );
          }
          return <Redirect to="mapping" />;
        }}
      </Query>
    );
  }
}
