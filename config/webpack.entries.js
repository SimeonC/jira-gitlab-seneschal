const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const paths = require('./paths');
const { frontendPages } = require('../src/frontendPages');

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

module.exports = {
  getEntry: (isDev) =>
    frontendPages.reduce((result, page) => {
      result[page] = [
        require.resolve('./polyfills'),
        resolveApp(`src/client/${page}.jsx`)
      ];
      if (isDev) {
        result[page].splice(
          1,
          0,
          require.resolve('react-dev-utils/webpackHotDevClient')
        );
      }
      return result;
    }, {}),
  getHtmlWebpackPlugins: (isDev) =>
    frontendPages.map(
      (page) =>
        new HtmlWebpackPlugin({
          inject: true,
          chunks: [page],
          template: paths.appHtml,
          filename: `${page}.html`,
          minify: isDev
            ? false
            : {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true
              }
        })
    )
};
