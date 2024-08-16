const path = require('path');
const Dotenv = require('dotenv-webpack');

module.exports = {
  entry: './src/income.js', // Update the entry point
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new Dotenv(),
  ],
};
