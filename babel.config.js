module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: true }]],
    // Inlines the generated migration SQL into the bundle so migrations can run
    // on-device with no filesystem access (§2).
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
