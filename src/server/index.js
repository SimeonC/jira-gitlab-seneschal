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
import path from 'path';
import initGraphQL from './initGraphQL';
import webhooksSetup from './webhooks';
import modelsSetup from './models';
import { processQueue as processWebhookQueue } from './webhooks/queue';
import { processQueue as processMigrationQueue } from './transition/migrationQueue';
import { version } from '../../package.json';
import { getMigrator, ensureCurrentMetaSchema } from './migrations';

const reactAdminFile = fs.readFileSync(
  path.join(__dirname, '../../build/client', 'admin.html')
);
const reactMrGlanceFile = fs.readFileSync(
  path.join(__dirname, '../../build/client', 'mrGlance.html')
);

// Password Must be 256 bytes (32 characters)

const app = express();

const addon = ac(app);

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

function sendFrontendPage(req, res, htmlFileContent) {
  let htmlContent = htmlFileContent;
  htmlContent = htmlContent.replace(
    /<\/head>/gi,
    `<meta name="token" content="${
      req.context.token
    }"><meta name="route" content="${req.query.route}"></head>`
  );
  htmlContent = htmlContent.replace(
    // this is unconventional but this must be loaded before `window.AP...` can be used
    /<body>/gi,
    `<body><script src="${
      req.context.hostBaseUrl
    }/atlassian-connect/all.js"></script>`
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

  app.get('/admin', addon.authenticate(), (req, res) => {
    const htmlFile = devMiddleware.fileSystem.readFileSync(
      config.output.path + '/admin.html'
    );
    sendFrontendPage(req, res, htmlFile.toString());
  });
  app.get(
    '/gitlab-seneschal-merge-requests',
    addon.authenticate(),
    (req, res) => {
      const htmlFile = devMiddleware.fileSystem.readFileSync(
        config.output.path + '/mrGlance.html'
      );
      sendFrontendPage(req, res, htmlFile.toString());
    }
  );

  app.use(express.static(path.join(__dirname, '../../public')));
  app.use(devMiddleware);
  app.use(hotware(compiler));
} else {
  // Enable static resource fingerprinting for far future expires caching in production
  app.use(express.static(path.join(__dirname, '../../build/client')));

  const adminContent = reactAdminFile.toString();
  const mrGlanceContent = reactMrGlanceFile.toString();

  function serveFrontendRequest(content) {
    return (req, res) => {
      sendFrontendPage(req, res, content);
    };
  }

  app.get('/admin', addon.authenticate(), serveFrontendRequest(adminContent));
  app.get(
    '/gitlab-seneschal-merge-requests',
    addon.authenticate(),
    serveFrontendRequest(mrGlanceContent)
  );
}

// Show nicer errors when in dev mode
if (devEnv) {
  app.use(errorHandler());
}

app.use('/graphql', addon.checkValidToken(), initGraphQL(addon));

webhooksSetup(addon, app);

// Root route. This route will serve the `atlassian-connect.json` unless the
// documentation url inside `atlassian-connect.json` is set
app.get('/', (req, res) => {
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
    http.createServer(app).listen(port, function() {
      console.log(
        'Add-on server running at http://' + os.hostname() + ':' + port
      );
      // Enables auto registration/de-registration of add-ons into a host in dev mode
      if (devEnv) addon.register();
    });
  })
  .catch((error) => console.error(error));
