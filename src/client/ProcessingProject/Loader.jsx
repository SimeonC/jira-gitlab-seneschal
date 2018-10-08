import React, { Component } from 'react';
import { Query, Mutation } from 'react-apollo';
import { Redirect, Link } from 'react-router-dom';
import Spinner from '@atlaskit/spinner';
import gql from 'graphql-tag';

const isProjectLoadingQuery = gql`
  query IsLoadingQuery($projectId: String!) {
    processingProject(gitlabProjectId: $projectId) {
      isLoading
      isProcessing
    }
  }
`;

class LoadGitlab extends Component {
  componentDidMount() {
    this.props.create();
  }

  render() {
    if (this.props.loading) {
      return <Spinner />;
    }
    return <Redirect to={this.props.redirectUrl} />;
  }
}

export default class Loader extends Component {
  render() {
    const {
      match: { url },
      gitlabProjectId
    } = this.props;
    if (!gitlabProjectId) {
      return (
        <div>
          No Project ID passed, go <Link to="/">Home</Link>
        </div>
      );
    }
    return (
      <Query
        query={isProjectLoadingQuery}
        variables={{ projectId: gitlabProjectId }}
      >
        {({ loading, data }) => {
          if (loading) return <Spinner />;
          const currentProject = data.processingProject;
          if (currentProject) {
            if (currentProject.isLoading) {
              return <Redirect to={`${url}/loading`} />;
            }
            if (currentProject.isProcessing) {
              return <Redirect to={`${url}/processing`} />;
            }
            return <Redirect to={`${url}/mapping`} />;
          }
          return (
            <Mutation
              mutation={gql`mutation Init { loadGitlabProject(projectId: "${gitlabProjectId}") { success } }`}
            >
              {(create, { loading: isCreating }) => (
                <LoadGitlab
                  loading={isCreating}
                  create={create}
                  redirectUrl={`${url}/loading`}
                />
              )}
            </Mutation>
          );
        }}
      </Query>
    );
  }
}
