// @flow
import express from 'express';
import expressGraphql from 'express-graphql';
import { makeExecutableSchema } from 'graphql-tools';
import path from 'path';
import schema from './schema.graphql';

const root = require('./rootResolver');

const app = express();

app.use(express.static(path.join(__dirname, 'build')));

app.use(
  '/graphql',
  expressGraphql({
    schema: makeExecutableSchema({ typeDefs: schema }),
    rootValue: root,
    graphiql: true
  })
);

app.get('/api/ping', (req, res) => res.send('pong'));

app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
);

app.listen(process.env.PORT || 8080);
