// @flow
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import errorHandler from 'errorhandler';
import morgan from 'morgan';
import fs from 'fs-extra';
import ac from 'atlassian-connect-express';
import http from 'http';
import os from 'os';
import expressGraphql from 'express-graphql';
import { makeExecutableSchema } from 'graphql-tools';
import path from 'path';
import rootSchema from './schema.graphql';
import gitlabSchema from './apis/gitlab.graphql';
import jiraSchema from './apis/jira.graphql';
import transitionProjectSchema from './apis/transitionProject.graphql';
import webhooksSchema from './apis/webhooks.graphql';
import root from './rootResolver';
import webhooksSetup from './webhooks';

const reactIndexFile = fs.readFileSync(
  path.join(__dirname, '../../build/client', 'index.html')
);

const schemas = [
  rootSchema,
  gitlabSchema,
  jiraSchema,
  transitionProjectSchema,
  webhooksSchema
];

// Password Must be 256 bytes (32 characters)

const app = express();

const addon = ac(app);

const encryptionKey = addon.config.lowdbEncryptionKey();

const port = addon.config.port();
const devEnv = app.get('env') === 'development';
if (devEnv) {
  process.env.NODE_ENV = 'development';
} else {
  process.env.NODE_ENV = 'production';
}

app.use(morgan(devEnv ? 'dev' : 'combined'));
// Include request parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
// Gzip responses when appropriate
app.use(compression());

// You need to instantiate the `atlassian-connect-express` middleware in order to get its goodness for free
app.use(addon.middleware());

if (devEnv) {
  const {
    createCompiler,
    prepareUrls
  } = require('react-dev-utils/WebpackDevServerUtils');
  const config = require('../../config/webpack.config.dev');
  const appName = require('../../package.json').name;
  const urls = prepareUrls('http', os.hostname(), port);
  const webpack = require('webpack');
  const middleware = require('webpack-dev-middleware');
  const hotware = require('webpack-hot-middleware');
  // Create a webpack compiler that is configured with custom messages.
  const compiler = createCompiler(webpack, config, appName, urls, false);
  const devMiddleware = middleware(compiler, {
    publicPath: '/admin'
  });
  app.get('/admin', addon.authenticate(), (req, res) => {
    res.set('Content-Type', 'text/html');
    const htmlFile = devMiddleware.fileSystem.readFileSync(
      config.output.path + '/index.html'
    );
    let htmlContent = htmlFile.toString();
    htmlContent = htmlContent.replace(
      /<\/head>/gi,
      `<meta name="token" content="${req.context.token}"></head>`
    );
    htmlContent = htmlContent.replace(
      /<\/body>/gi,
      `<script src="${
        req.context.hostBaseUrl
      }/atlassian-connect/all.js"></script></body>`
    );
    res.send(htmlContent);
  });
  app.use(devMiddleware);
  app.use(hotware(compiler));
} else {
  // Enable static resource fingerprinting for far future expires caching in production
  app.use(express.static(path.join(__dirname, '../../build/client')));

  app.get('/admin', addon.authenticate(), (req, res) => {
    let htmlContent = reactIndexFile.toString();
    htmlContent = htmlContent.replace(
      /<\/head>/gi,
      `<meta name="token" content="${req.context.token}"></head>`
    );
    htmlContent = htmlContent.replace(
      /<\/body>/gi,
      `<script src="${
        req.context.hostBaseUrl
      }/atlassian-connect/all.js"></script></body>`
    );
    res.send(htmlContent);
  });
}

// Show nicer errors when in dev mode
if (devEnv) {
  app.use(errorHandler());
}

app.use(
  '/graphql',
  addon.checkValidToken(),
  expressGraphql({
    schema: makeExecutableSchema({
      typeDefs: schemas,
      resolvers: root(encryptionKey, addon)
    }),
    graphiql: true
  })
);

webhooksSetup(encryptionKey, addon, app);

// Root route. This route will serve the `atlassian-connect.json` unless the
// documentation url inside `atlassian-connect.json` is set
app.get('/', function(req, res) {
  res.format({
    // If the request content-type is text-html, it will decide which to serve up
    'text/html': function() {
      res.redirect('/atlassian-connect.json');
    },
    // This logic is here to make sure that the `atlassian-connect.json` is always
    // served up when requested by the host
    'application/json': function() {
      res.redirect('/atlassian-connect.json');
    }
  });
});

// Boot the damn thing
http.createServer(app).listen(port, function() {
  console.log('Add-on server running at http://' + os.hostname() + ':' + port);
  // Enables auto registration/de-registration of add-ons into a host in dev mode
  if (devEnv) addon.register();
});
