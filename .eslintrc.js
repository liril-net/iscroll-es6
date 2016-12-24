module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  extends: 'airbnb-base',
  'settings': {
    'import/resolver': {
      'webpack': {
        'config': 'webpack.config.js'
      }
    }
  },
  "env": {
    "browser": true,
    "node": true,
    "jasmine": true
  },
  // add your custom rules here
  'rules': {
    // don't require .vue extension when importing
    'import/extensions': ['error', 'always', {
      'js': 'never'
    }],
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    "comma-dangle": ['error', 'never'],
    'no-console': 0,
    'semi': ['error', 'never'],
    'new-cap': ['error', {
      'capIsNew': false
    }],
    'template-curly-spacing': ['error', 'always'],
    'no-underscore-dangle': 0,
    'no-plusplus': 0,
    'func-names': 0,
    'consistent-return': 0,
    'no-param-reassign': 0,
    'no-mixed-operators': 0
  }
}
