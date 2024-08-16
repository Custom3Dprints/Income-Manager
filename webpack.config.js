const path = require('path');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');

module.exports = {
    entry: './src/income.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
        ],
    },
    plugins: [
        new Dotenv(),
        new webpack.DefinePlugin({
            'process.env.APIKEY': JSON.stringify(process.env.APIKEY),
            'process.env.APPID': JSON.stringify(process.env.APPID),
            'process.env.AUTHDOMAIN': JSON.stringify(process.env.AUTHDOMAIN),
            'process.env.DATABSEURL': JSON.stringify(process.env.DATABSEURL),
            'process.env.MEASUREMENTID': JSON.stringify(process.env.MEASUREMENTID),
            'process.env.MESSAGINGSENDERID': JSON.stringify(process.env.MESSAGINGSENDERID),
            'process.env.PROJECTID': JSON.stringify(process.env.PROJECTID),
            'process.env.STORAGEBUCKET': JSON.stringify(process.env.STORAGEBUCKET),
        }),
    ],
    mode: 'production',  // Use 'development' for local development
};
