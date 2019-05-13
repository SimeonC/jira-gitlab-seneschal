import fs from 'fs-extra';
import path from 'path';
import expressGraphql from 'express-graphql';
import { makeExecutableSchema } from 'graphql-tools';
import root from './rootResolver';
import rootSchema from './schema.graphql';
import gitlabSchema from './apis/gitlab.graphql';
import jiraSchema from './apis/jira.graphql';
import transitionProjectSchema from './apis/transitionProject.graphql';
import webhooksSchema from './apis/webhooks.graphql';
import projectMappingApi from './apis/projectMapping';

const schemas = [
  rootSchema,
  gitlabSchema,
  jiraSchema,
  transitionProjectSchema,
  webhooksSchema
];

const modelSchemaFileNames = fs
  .readdirSync(path.join(__dirname, './models'))
  .reduce((result, fileName) => {
    if (!/\.graphql$/.test(fileName)) return result;
    result.push(fileName);
    return result;
  }, []);

export default function initGraphQL(addon) {
  let resolvers = root(addon);
  resolvers = projectMappingApi(addon, resolvers);
  return expressGraphql({
    schema: makeExecutableSchema({
      typeDefs: schemas.concat(
        modelSchemaFileNames.map((fileName) => require(`./models/${fileName}`))
      ),
      resolvers
    }),
    graphiql: true
  });
}
