module.exports = {
  mode: 'none',
  entry: __dirname + '/src/objext.js',
  output: {
    path: __dirname + '/dist',
    filename: 'objext.js',
    library: objext,
    libraryTarget: 'umd',
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
}