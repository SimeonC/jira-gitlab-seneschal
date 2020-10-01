import React from 'react';
import ReactDOM from 'react-dom';
import AppWrapper from './AppWrapper';
import App from './ProjectSettings/index';

ReactDOM.render(
  <AppWrapper
    invalidSetupChildren={
      <div>
        Please contact your atlassian administrator to configure the application
      </div>
    }
  >
    <App />
  </AppWrapper>,
  document.getElementById('root')
);
