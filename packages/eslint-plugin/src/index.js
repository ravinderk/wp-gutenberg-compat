const noIncompatibleVersion = require('./rules/no-incompatible-version.js');

const plugin = {
  meta: {
    name: 'eslint-plugin-wp-gutenberg-compat',
    version: '0.1.0',
  },
  rules: {
    'no-incompatible-version': noIncompatibleVersion,
  },
  configs: {},
};

// Build recommended flat config referencing the plugin itself
plugin.configs.recommended = {
  plugins: {
    'wp-gutenberg-compat': plugin,
  },
  rules: {
    'wp-gutenberg-compat/no-incompatible-version': 'error',
  },
};

module.exports = plugin;
