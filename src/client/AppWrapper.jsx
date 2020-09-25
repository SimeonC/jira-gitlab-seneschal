// @flow
import React, { type Node } from 'react';
import styled from '@emotion/styled';
import '@atlaskit/css-reset';
import { ApolloProvider } from '@apollo/client';
import client from './graphqlClient';
import Authenticate from './Authenticate';

type PropsType = {
  children: Node,
  invalidSetupChildren?: Node
};

const AppStyles = styled.div`
  padding: 0 20px;
  min-height: 800px;
`;

const AppWrapper = ({ children, invalidSetupChildren }: PropsType) => {
  return (
    <AppStyles>
      <ApolloProvider client={client}>
        <Authenticate invalidSetupChildren={invalidSetupChildren}>
          {children}
        </Authenticate>
      </ApolloProvider>
    </AppStyles>
  );
};

export default AppWrapper;
