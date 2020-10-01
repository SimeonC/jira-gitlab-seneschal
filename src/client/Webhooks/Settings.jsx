// @flow
import React from 'react';
import Page from '@atlaskit/page';
import Toggle from '../SettingsToggle';

const Settings = () => {
  return (
    <Page>
      <Toggle
        name="autoAdd"
        label="Every 24 hours, check for out of date webhooks and newly added projects and automatically update them."
      />
      <Toggle
        name="enableUpdateOnEdits"
        label="Enable gitlab comment/description updating when it is edited, all edits by the user used by the Seneschal will be ignored"
      />
      <Toggle
        name="useDescriptionTransitions"
        label="Use tickets keys in the Merge Request description as a valid location to trigger transitions"
      />
    </Page>
  );
};

export default Settings;
