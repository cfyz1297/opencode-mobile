// Metro bundler config.
//
// Plain Expo default config. (Analytics was removed from the app; the former
// Sentry-wrapped config lived here and broke the JS bundling task in CI once
// @sentry/react-native was uninstalled.)
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

module.exports = config
