/**
 * Shared compat-data fixture used by rule tests.
 */
export const compatData = {
  generated: '2026-03-17T00:00:00Z',
  lastGutenbergTag: 'v21.9.0',
  wpGutenbergMap: {
    '6.9': '21.9',
    '6.8': '20.4',
    '6.7': '19.3',
    '6.6': '18.5',
    '6.5': '17.7',
    '6.4': '16.7',
  },
  packages: {
    '@wordpress/components': {
      '29.0.0': { gutenberg: '21.9', wordpress: '6.9' },
      '28.0.0': { gutenberg: '20.4', wordpress: '6.8' },
      '27.0.0': { gutenberg: '19.3', wordpress: '6.7' },
      '26.0.0': { gutenberg: '18.5', wordpress: '6.6' },
      '25.0.0': { gutenberg: '17.7', wordpress: '6.5' },
      '24.0.0': { gutenberg: '16.7', wordpress: '6.4' },
    },
    '@wordpress/block-editor': {
      '15.0.0': { gutenberg: '21.9', wordpress: '6.9' },
      '14.0.0': { gutenberg: '20.4', wordpress: '6.8' },
      '13.0.0': { gutenberg: '19.3', wordpress: '6.7' },
      '12.0.0': { gutenberg: '18.5', wordpress: '6.6' },
      '11.0.0': { gutenberg: '17.7', wordpress: '6.5' },
      '10.0.0': { gutenberg: '16.7', wordpress: '6.4' },
    },
  },
};
