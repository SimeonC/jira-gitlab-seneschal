// @flow
import React, { useEffect, useState } from 'react';
import Tabs from '@atlaskit/tabs';
import styled from '@emotion/styled';
import Spinner from '@atlaskit/spinner';

import Transitions from './ProjectTransitions';

const Wrapper = styled.div`
  margin-top: 12px;
`;

export default function ProjectSettings() {
  const [tabs, setTabs] = useState();

  useEffect(() => {
    window.AP.context.getContext((response) => {
      setTabs(
        [{ label: 'Transitions', Component: Transitions }].map(
          ({ label, Component }) => ({
            label,
            content: (
              <Wrapper>
                <Component jiraProjectId={response.jira.project.id} />
              </Wrapper>
            )
          })
        )
      );
    });
  }, []);

  if (!tabs) return <Spinner />;
  return <Tabs tabs={tabs} />;
}
