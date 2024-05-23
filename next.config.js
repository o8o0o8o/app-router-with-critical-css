const CopyWebpackPlugin = require("copy-webpack-plugin");

const config = {
  webpack: (config) => {
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [{ from: "styles", to: "static/css" }],
      })
    );
    return config;
  },
};

module.exports = config;
