module.exports = {
  mode: 'none',
  entry: __dirname + '/src/objext.js',
  output: {
    path: __dirname + '/dist',
    filename: 'objext.js',
    library: 'objext',
    libraryTarget: 'umd',
    globalObject: 'typeof window !== undefined ? window : typeof global !== undefined ? global : typeof self !== undefined ? self : this',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
          }
        ],
      },
    ],
  },
  optimization: {
    minimize: false,
    usedExports: true,
    sideEffects: true,
  },
}
