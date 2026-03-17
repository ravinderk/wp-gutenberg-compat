import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const compatData = require('./compat-data.json');

export default compatData;
