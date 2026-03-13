// Extend Expo's Metro config to alias removed RN internals used by @expo/metro-runtime
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('metro-config').ConfigT} */
const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  'react-native/Libraries/Utilities/LoadingView': require.resolve('./shims/LoadingView'),
};
config.resolver.assetExts = [
  ...(config.resolver.assetExts || []),
  'wasm',
];

module.exports = config;
