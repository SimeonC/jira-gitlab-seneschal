import React, { Component } from 'react';
import { Query, Mutation } from 'react-apollo';
import { Redirect, Link } from 'react-router-dom';
import Spinner from '@atlaskit/spinner';
import gql from 'graphql-tag';

const processingProjectsQuery = gql`
  {
    processingProjects {
      projectId
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
      <Query query={processingProjectsQuery}>
        {({ loading, data }) => {
          if (loading) return <Spinner />;
          const currentProject = data.processingProjects.find(
            ({ projectId }) => projectId === gitlabProjectId
          );
          if (currentProject) {
            if (currentProject.isProcessing) {
              return <Redirect to={`${url}/processing`} />;
            }
            return <Redirect to={`${url}/mapping`} />;
          }
          return (
            <Mutation
              mutation={gql`mutation Init { loadGitlabProject(projectId: "${gitlabProjectId}") { labels } }`}
            >
              {(create, { loading: isCreating }) => (
                <LoadGitlab
                  loading={isCreating}
                  create={create}
                  redirectUrl={`${url}/mapping`}
                />
              )}
            </Mutation>
          );
        }}
      </Query>
    );
  }
}
