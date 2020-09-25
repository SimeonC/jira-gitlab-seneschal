// @flow
import React, { type Node } from 'react';
import { Query } from '@apollo/client/react/components';
import { gql } from '@apollo/client';
import Spinner from '@atlaskit/spinner';

import GitlabTokenForm from './GitlabTokenForm';

type PropsType = {
  children: Node,
  invalidSetupChildren?: Node
};

const Authenticate = ({ children, invalidSetupChildren }: PropsType) => {
  return (
    <Query
      query={gql`
        {
          isSetup {
            success
          }
        }
      `}
    >
      {({ loading, error, data = {} }) => {
        if (loading) {
          return <Spinner />;
        }
        if (error || !data || !data.isSetup.success) {
          return invalidSetupChildren || <GitlabTokenForm />;
        }
        return children;
      }}
    </Query>
  );
};

export default Authenticate;
