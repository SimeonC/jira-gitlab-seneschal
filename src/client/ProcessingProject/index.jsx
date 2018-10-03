import React, { Component } from 'react';
import { Route, Switch } from 'react-router-dom';

import Mapper from './Mapper';
import Loader from './Loader';
import Processing from './Processing';
import Initialising from './Initialising';

// Step 1. Select Gitlab Project
// Step 2. Load Gitlab Project into file system
// Step 3. Select Jira Project
// Step 4. Load Jira IssueTypes, Versions, Components
// Step 5. Build Mapping (Must map all Milestones -> Versions or ignore)
// Step 6. Confirm and run transition

export default class ProcessingProject extends Component {
  render() {
    const { match } = this.props;
    return (
      <Switch>
        <Route
          path={`${match.url}/processing`}
          render={(props) => (
            <Processing
              {...props}
              gitlabProjectId={match.params.gitlabProjectId}
            />
          )}
        />
        <Route
          path={`${match.url}/mapping`}
          render={(props) => (
            <Mapper {...props} gitlabProjectId={match.params.gitlabProjectId} />
          )}
        />
        <Route
          path={`${match.url}/loading`}
          render={(props) => (
            <Initialising
              {...props}
              gitlabProjectId={match.params.gitlabProjectId}
            />
          )}
        />
        <Route
          render={(props) => (
            <Loader {...props} gitlabProjectId={match.params.gitlabProjectId} />
          )}
        />
      </Switch>
    );
  }
}
