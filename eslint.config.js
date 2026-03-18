'use strict';

const path = require('path');
const { includeIgnoreFile } = require('@eslint/compat');
const prettierConfig = require('eslint-config-prettier');

const prettierIgnorePath = path.resolve(__dirname, '.prettierignore');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
    includeIgnoreFile(prettierIgnorePath),
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
        },
    },
    prettierConfig,
];
