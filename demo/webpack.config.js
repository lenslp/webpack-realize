let path = require("path");

class Customer_Plugin {
  apply(compiler) {
    compiler.hooks.emit.tap("emit", function () {
      console.log("emit");
    });
  }
}

module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /.less$/,
        use: [
          path.resolve(__dirname, "loaders", "style-loader"),
          path.resolve(__dirname, "loaders", "less-loader"),
        ],
      },
    ],
  },
  plugins: [new Customer_Plugin()],
};
