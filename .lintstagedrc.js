'use strict';

module.exports = {
    '*.{js,ts}': ['prettier --write'],
    '*.{json,yml,yaml}': ['prettier --write'],
    '*.md': ['prettier --write'],
};
