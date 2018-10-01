import { ApolloClient } from 'apollo-client';
import { createHttpLink } from 'apollo-link-http';
import { setContext } from 'apollo-link-context';
import { InMemoryCache } from 'apollo-cache-inmemory';

const httpLink = createHttpLink({
  uri: '/graphql'
});

const token = document
  .querySelector('meta[name=token]')
  .getAttribute('content');

const authLink = setContext((_, { headers }) => {
  // return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      Authorization: token ? `JWT ${token}` : ''
    }
  };
});

export default new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});
