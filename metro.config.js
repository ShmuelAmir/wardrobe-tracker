const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// drizzle/migrations.js imports the generated .sql files directly; metro has to
// treat them as source for babel-plugin-inline-import to inline them (§2).
config.resolver.sourceExts.push('sql');

module.exports = config;
