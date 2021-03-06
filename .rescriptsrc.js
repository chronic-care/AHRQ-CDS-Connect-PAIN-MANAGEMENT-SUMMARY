const {edit, editWebpackPlugin, getWebpackPlugin, appendWebpackPlugin} = require('@rescripts/utilities')
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

// This is a root rescript file.  Together with the rescripts CLI, it allows the default
// Create React App (CRA) configurations to be modified.  In the case of the Pain Management
// Summary, we must modify the WebpackConfig to setup the launch.html entry point and to
// add some aliases to replace large unnecessary files with smaller stubs.
//
// See: https://github.com/harrysolovay/rescripts

// Adds the launch.js entry.
// In production, this transforms:
//   entry: ["/path/to/pain-management-summary/src/index.js"]
// to
//   entry: {
//     main: ["/path/to/pain-management-summary/src/index.js"],
//     launch: ["/path/to/pain-management-summary/src/index.js"]
//   }
// In development, it is similar, but each array also contains a Webpack hotloader.
const addLaunch = function (config) {
  return edit(
    function (entries) {
      if (!Array.isArray(entries) || entries.filter(function (e) {
          return e.endsWith(path.sep + 'index.tsx');
        }).length !== 1) {
        console.error('Cannot add launch.js to entry. Unexpected starting value for entry:', entries);
        return entries;
      }
      return {
        main: entries,
        launch: entries.map(function (e) {
            return e.replace(/[\/\\]index.tsx$/, path.sep + 'launch.ts');
          })
      };
    },
    [['entry']],
    config
  );
}

// Changes the output filename in development (not necessary in production).
// In development, this transforms:
//   output.filename: "static/js/bundle.js"
// to
//   output.filename: "static/js/[name].js"
const changeOutputFilenameForDev = function (config) {
  if (config.mode !== 'development') {
    return config;
  }
  return edit(
    function (filename) {
      if (!filename.endsWith('/bundle.js')) {
        console.error('Cannot modify output filename. Unexpected starting value:', filename);
        return filename;
      }
      return filename.replace(/\/bundle.js$/, '/[name].js');
    },
    [['output', 'filename']],
    config
  );
}

// Changes the existing HtmlWebpackPlugin for index.html to specify that it should use the main chunk.
// This production and development this transforms HtmlWebpackPlugin's:
//   options.chunks: "all"
// to
//   options.chunks: ["main"]
const editChunksInHtmlWebpackPluginForIndex = function (config) {
  return editWebpackPlugin(
    function (p) {
      if (p.options.filename !== 'index.html') {
        console.error('Cannot modify HtmlWebpackPlugin. Unexpected filename:', p.options.filename);
        return p;
      } else if (p.options.chunks !== 'all') {
        console.error('Cannot modify HtmlWebpackPlugin. Unexpected chunks:', p.options.chunks);
        return p;
      }
      p.options.chunks = ['main'];
      return p;
    },
    'HtmlWebpackPlugin',
    config
  );
}

// Adds a new HtmlWebpackPlugin for launch.html.  It is configured the same as the index.html one,
// except the filename is "launch.html" and the chunks are ["launch"].
const addHtmlWebpackPluginForLaunch = function (config) {
  const indexPlugin = getWebpackPlugin('HtmlWebpackPlugin', config);
  if (indexPlugin == null || indexPlugin.options.filename !== 'index.html') {
    console.error('Cannot find HtmlWebpackPlugin for index.html to use as baseline for launch plugin.');
    alert('Cannot find HtmlWebpackPlugin for index.html to use as baseline for launch plugin.');
    return config;
  }

  const launchOptions = Object.assign({}, indexPlugin.options);
  launchOptions.filename = 'launch.html';
  launchOptions.chunks = ['launch'];
  return appendWebpackPlugin(
    new HtmlWebpackPlugin(launchOptions),
    config
  );
}

// Stubs out files that are not needed but take up lots of space in webpacked source. This includes:
// ./fhir/models (from cql-execution)
// ./modelInfos/fhir-modelinfo-1.6.xml.js (from cql-exec-fhir)
// ./modelInfos/fhir-modelinfo-3.0.0.xml.js (from cql-exec-fhir)
// ./modelInfos/fhir-modelinfo-4.0.0.xml.js (from cql-exec-fhir)
const stubUnneededFiles = function (config) {
  return edit(
    function (resolve) {
      // currently, resolve.alias exists (for react-native), but play it safe in case this
      // changes in the future
      if (resolve.alias == null) {
        resolve.alias = {};
      }
      // Replace cql-execution's packaged FHIR model w/ a stubbed version since we
      // don't use the FHIR model from cql-execution and it takes up a lot of space.
      resolve.alias['./fhir/models'] = path.resolve(__dirname, './src/stubs/fhir-models.js');
      // Replace cql-exec-fhir's bundled 1.6, and 3.0.0 modelinfos with stubs since we
      // only use the 1.0.2 and 4.0.0 modelinfos and the others take up a lot of space.
      //  bryant 3.26.2020 - put 3.00 back in to use for MyPAIN/PainManager work
      resolve.alias['./modelInfos/fhir-modelinfo-1.6.xml.js'] = path.resolve(__dirname, './src/stubs/fhir-modelinfo-stub.xml.js');
      //      resolve.alias['./modelInfos/fhir-modelinfo-3.0.0.xml.js'] = path.resolve(__dirname, './src/stubs/fhir-modelinfo-stub.xml.js');
      return resolve;
    },
    [['resolve']],
    config
  );
}

// Logs the config, mainly useful for debugging
const logConfig = function (config) {
  console.log(JSON.stringify(config, null, 2));
  return config;
}
// uncomment below to log config between each rescript
// logConfig.isMiddleware = true;

// The module.exports determines which scripts actually get run!
module.exports = [
  addLaunch,
  changeOutputFilenameForDev,
  editChunksInHtmlWebpackPluginForIndex,
  addHtmlWebpackPluginForLaunch,
  stubUnneededFiles
  // ,logConfig
];