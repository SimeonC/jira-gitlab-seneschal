import React, { Component } from 'react';
import ApolloClient from 'apollo-boost';
import { ApolloProvider, Query } from 'react-apollo';
import gql from 'graphql-tag';

const client = new ApolloClient({
  uri: '/graphql'
});

export default class App extends Component {
  render() {
    return (
      <ApolloProvider client={client}>
        <div className="App">
          <header className="App-header">
            <h1 className="App-title">Welcome to React</h1>
          </header>
          <p className="App-intro">
            To get started, edit <code>src/App.js</code> and save to reload.
          </p>
          <Query
            query={gql`
              {
                message
              }
            `}
          >
            {({ loading, error, data }) => (
              <div>
                is loading {loading ? 'true' : 'false'} result:{' '}
                {JSON.stringify(data || {})}
              </div>
            )}
          </Query>
        </div>
      </ApolloProvider>
    );
  }
}
