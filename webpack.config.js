const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  entry: {
    income: './income.js',
    history: './history.js',
    spending: './spending.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: 'production',
  devtool: 'source-map',
  resolve: {
    extensions: ['.js']
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.apiKey': JSON.stringify(process.env.apiKey),
      'process.env.authDomain': JSON.stringify(process.env.authDomain),
      'process.env.databaseURL': JSON.stringify(process.env.databaseURL),
      'process.env.projectId': JSON.stringify(process.env.projectId),
      'process.env.storageBucket': JSON.stringify(process.env.storageBucket),
      'process.env.messagingSenderId': JSON.stringify(process.env.messagingSenderId),
      'process.env.appId': JSON.stringify(process.env.appId),
      'process.env.measurementId': JSON.stringify(process.env.measurementId)
    })
  ]
};
