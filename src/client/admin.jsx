import React from 'react';
import ReactDOM from 'react-dom';
import AppWrapper from './AppWrapper';
import { HashRouter, Redirect, Route, Switch } from 'react-router-dom';

import Migrations from './Migrations';
import Webhooks from './Webhooks';
import WebhookErrors from './WebhookErrors';
import ProcessingProject from './ProcessingProject';
import Setup from './Setup';

let defaultRoute = document
  .querySelector('meta[name=route]')
  .getAttribute('content');

const App = () => (
  <AppWrapper>
    <HashRouter>
      <Switch>
        <Route path="/project/:gitlabProjectId" component={ProcessingProject} />
        <Route path="/webhooks" component={Webhooks} />
        <Route path="/webhook-errors" component={WebhookErrors} />
        <Route path="/migrations" component={Migrations} />
        <Route path="/setup" component={Setup} />
        <Route render={() => <Redirect to={defaultRoute} />} />
      </Switch>
    </HashRouter>
  </AppWrapper>
);

ReactDOM.render(<App />, document.getElementById('root'));
