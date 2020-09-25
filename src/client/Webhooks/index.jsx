// @flow
import React from 'react';
import Tabs from '@atlaskit/tabs';
import styled from '@emotion/styled';

import Status from './Status';
import Settings from './Settings';
import Transitions from './Transitions';
import Create from './CreateWebhook';

const Wrapper = styled.div`
  margin-top: 12px;
`;

const tabs = [
  { label: 'Status', Component: Status },
  { label: 'Settings', Component: Settings },
  { label: 'Transitions', Component: Transitions },
  { label: 'Add New', Component: Create }
].map(({ label, Component }) => ({
  label,
  content: (
    <Wrapper>
      <Component />
    </Wrapper>
  )
}));

const Webhooks = () => <Tabs tabs={tabs} />;

export default Webhooks;
