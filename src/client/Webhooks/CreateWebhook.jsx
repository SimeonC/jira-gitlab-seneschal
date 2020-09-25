// @flow
import React, { useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/core';
import { useQuery, gql } from '@apollo/client';

import Page from '@atlaskit/page';
import Button from '@atlaskit/button/loading-button';
import BaseSelect from '@atlaskit/select';

import { useUpdateWebhook } from './useWebhooks';

const fullWidthCss = css`
  display: flex;
  flex: 1 1 100%;
`;

const Row = styled.div`
  ${fullWidthCss};
  align-items: center;
`;

const SelectWrapper = styled.div`
  ${fullWidthCss};
  padding: 0 12px;
  > div {
    ${fullWidthCss};
  }
`;

const Select = styled(BaseSelect)`
  width: 100%;
  > div {
    width: 100%;
  }
`;

const getOptionValue = (option) => option.id;
const getOptionLabel = (option) => option.nameWithNamespace || option.name;

const projectsQuery = gql`
  {
    gitlabProjects {
      id
      nameWithNamespace
    }
  }
`;

const CreateWebhook = () => {
  const { loading, error, data = {} } = useQuery(projectsQuery);
  const [upsertWebhook, { loading: isSaving }] = useUpdateWebhook();
  const [gitlabProjectId, setGitlabProjectId] = useState();

  let content = null;
  if (error) {
    content = <span>{error.toString()}</span>;
  } else {
    content = (
      <Row>
        <SelectWrapper>
          <Select
            isLoading={loading}
            options={data.gitlabProjects}
            getOptionValue={getOptionValue}
            getOptionLabel={getOptionLabel}
            onChange={(option) => {
              setGitlabProjectId(option.id);
            }}
          />
        </SelectWrapper>
        <Button
          appearance="primary"
          isDisabled={!gitlabProjectId}
          isLoading={isSaving}
          onClick={() => upsertWebhook(gitlabProjectId)}
        >
          Create Webhooks
        </Button>
      </Row>
    );
  }

  return (
    <Page>
      <h4>Create/Update Project Webhook</h4>
      {content}
    </Page>
  );
};

export default CreateWebhook;
