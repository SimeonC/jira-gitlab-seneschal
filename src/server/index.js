// @flow
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import errorHandler from 'errorhandler';
import morgan from 'morgan';
import fs from 'fs-extra';
import ac from 'atlassian-connect-express';
import helmet from 'helmet';
import nocache from 'nocache';
import http from 'http';
import os from 'os';
import path from 'path';
import initGraphQL from './initGraphQL';
import webhooksSetup, { runWebhookChecks } from './webhooks';
import modelsSetup from './models';
import { processQueue as processWebhookQueue } from './webhooks/queue';
import { processQueue as processMigrationQueue } from './transition/migrationQueue';
import { version } from '../../package.json';
import { getMigrator, ensureCurrentMetaSchema } from './migrations';
import logger from './utils/logger';
import getAppUrl from './utils/getAppUrl';
import { frontendPages } from '../frontendPages';

// Password Must be 256 bytes (32 characters)

const app = express();

const addon = ac(app, undefined, logger);

const port = addon.config.port();
process.env.PORT = port;

const dbSetupPromise = modelsSetup(addon.schema)
  .then(() => getMigrator(addon.schema, addon))
  .then((migrator) =>
    ensureCurrentMetaSchema(migrator)
      .then(() => migrator.pending())
      .then((migrations) => {
        if (migrations.length === 0) {
          console.log(
            'No migrations were executed, database schema was already up to date.'
          );
          return;
        }
        return migrator.up({});
      })
  );
const devEnv = app.get('env') === 'development';
if (devEnv) {
  process.env.NODE_ENV = 'development';
} else {
  process.env.NODE_ENV = 'production';
}

// Atlassian security policy requirements
// http://go.atlassian.com/security-requirements-for-cloud-apps
// HSTS must be enabled with a minimum age of at least one year
app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: false
  })
);
app.use(
  helmet.referrerPolicy({
    policy: ['origin']
  })
);

app.use(morgan(devEnv ? 'dev' : 'combined'));
// Include request parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
// Gzip responses when appropriate
app.use(compression());

// You need to instantiate the `atlassian-connect-express` middleware in order to get its goodness for free
app.use(addon.middleware());

function sendFrontendPage(req, res, htmlFileContent) {
  let htmlContent = htmlFileContent;
  htmlContent = htmlContent.replace(
    /<\/head>/gi,
    `<meta name="token" content="${req.context.token}"><meta name="route" content="${req.query.route}"></head>`
  );
  htmlContent = htmlContent.replace(
    // this is unconventional but this must be loaded before `window.AP...` can be used
    /<body>/gi,
    `<body><script src="https://connect-cdn.atl-paas.net/all.js"></script>`
  );
  res.set('Content-Type', 'text/html');
  res.send(htmlContent);
}

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

  frontendPages.forEach((page) => {
    app.get(`/${page}`, addon.authenticate(), (req, res) => {
      const htmlFile = devMiddleware.fileSystem.readFileSync(
        `${config.output.path}/${page}.html`
      );
      sendFrontendPage(req, res, htmlFile.toString());
    });
  });

  app.use(express.static(path.join(__dirname, '../../public')));
  app.use(devMiddleware);
  app.use(hotware(compiler));
} else {
  // Enable static resource fingerprinting for far future expires caching in production
  app.use(express.static(path.join(__dirname, '../client')));

  function serveFrontendRequest(content) {
    return (req, res) => {
      sendFrontendPage(req, res, content);
    };
  }

  frontendPages.forEach((page) => {
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../client', `${page}.html`),
      'utf8'
    );
    app.get(
      `/${page}`,
      addon.authenticate(),
      serveFrontendRequest(fileContent)
    );
  });
}
// Atlassian security policy requirements
// http://go.atlassian.com/security-requirements-for-cloud-apps
app.use(nocache());

// Show nicer errors when in dev mode
if (devEnv) {
  app.use(errorHandler());
}

app.use('/graphql', addon.checkValidToken(), initGraphQL(addon));

app.post('/jira-project-updated', async (req, res) => {
  res.status(200);
  res.send('ok');
  const {
    project: { id, key }
  } = req.body;

  const currentProject = await addon.schema.models.WebhookTransitionMaps.findOne(
    {
      where: {
        jiraProjectId: `${id}`
      }
    }
  );
  if (currentProject.jiraProjectKey !== key) {
    await addon.schema.models.WebhookTransitionMaps.update(
      {
        jiraProjectKey: key
      },
      {
        where: {
          jiraProjectId: `${id}`
        }
      }
    );
  }
});

webhooksSetup(addon, app);

// Root route. This route will serve the `atlassian-connect.json` unless the
// documentation url inside `atlassian-connect.json` is set
app.get('/', (req, res) => {
  res.format({
    // If the request content-type is text-html, it will decide which to serve up
    'text/html': function () {
      res.redirect('/atlassian-connect.json');
    },
    // This logic is here to make sure that the `atlassian-connect.json` is always
    // served up when requested by the host
    'application/json': function () {
      res.redirect('/atlassian-connect.json');
    }
  });
});

// Health Endpoint for load monitoring tools
app.get('/version', (req, res) => {
  res.status(200);
  res.send(version);
});

// Health Endpoint for load monitoring tools
app.get('/health', (req, res) => {
  res.status(200);
  res.send('ok');
});

// Boot the damn thing
dbSetupPromise
  .then(() => {
    // start the process running to pick up any that were left over after last shutdown.
    // Wait 1 minute just in case - there's startup stuff I can't manage to get around
    setTimeout(() => {
      processWebhookQueue(addon);
      processMigrationQueue(addon);
    }, 60000);
    http.createServer(app).listen(port, function () {
      console.log(`Add-on server running at ${getAppUrl()}`);
      // Enables auto registration/de-registration of add-ons into a host in dev mode
      let finalPromise = Promise.resolve();
      if (devEnv) finalPromise = addon.register();
      finalPromise.then(() => runWebhookChecks(addon));
    });
  })
  .catch((error) => console.error(error));
