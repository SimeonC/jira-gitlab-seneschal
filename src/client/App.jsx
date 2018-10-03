import React, { Component } from 'react';
import '@atlaskit/css-reset';
import styled from 'styled-components';
import client from './graphqlClient';
import { ApolloProvider } from 'react-apollo';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';

import Authenticate from './Authenticate';
import Migrations from './Migrations';
import Webhooks from './Webhooks';
import ProcessingProject from './ProcessingProject';

// Step 1. Select Gitlab Project
// Step 2. Load Gitlab Project into file system
// Step 3. Select Jira Project
// Step 4. Load Jira IssueTypes, Versions, Components
// Step 5. Build Mapping (Must map all Milestones -> Versions or ignore)
// Step 6. Confirm and run transition

const AppStyles = styled.div`
  padding: 0 20px;
  min-height: 800px;
`;

let defaultRoute = document
  .querySelector('meta[name=route]')
  .getAttribute('content');

export default class App extends Component {
  render() {
    return (
      <AppStyles>
        <ApolloProvider client={client}>
          <Authenticate>
            <HashRouter>
              <Switch>
                <Route
                  path="/project/:gitlabProjectId"
                  component={ProcessingProject}
                />
                <Route path="/webhooks" component={Webhooks} />
                <Route path="/migrations" component={Migrations} />
                <Route render={() => <Redirect to={defaultRoute} />} />
              </Switch>
            </HashRouter>
          </Authenticate>
        </ApolloProvider>
      </AppStyles>
    );
  }
}
