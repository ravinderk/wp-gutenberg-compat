import noIncompatibleVersion from './rules/no-incompatible-version.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-gutenberg-compat',
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
    'gutenberg-compat': plugin,
  },
  rules: {
    'gutenberg-compat/no-incompatible-version': 'error',
  },
};

export default plugin;
