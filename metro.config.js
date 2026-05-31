const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');

/** Map `firebase/auth` to @firebase/auth RN entry so Callable requests include a valid Firebase ID token. */
const projectRoot = __dirname;
const firebaseAuthRnPath = path.resolve(projectRoot, 'node_modules/@firebase/auth/dist/rn/index.js');

const config = getDefaultConfig(projectRoot);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && moduleName === 'firebase/auth') {
    return { type: 'sourceFile', filePath: firebaseAuthRnPath };
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
