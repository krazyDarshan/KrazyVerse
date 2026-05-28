const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules');
const projectNodeModules = path.resolve(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));
config.resolver.nodeModulesPaths = [workspaceNodeModules, projectNodeModules];

config.resolver.extraNodeModules = {
  react: path.resolve(workspaceNodeModules, 'react'),
  'react/jsx-runtime': path.resolve(workspaceNodeModules, 'react/jsx-runtime.js'),
  'react/jsx-dev-runtime': path.resolve(workspaceNodeModules, 'react/jsx-dev-runtime.js'),
  'react-native': path.resolve(workspaceNodeModules, 'react-native'),
  '@react-native/virtualized-lists': path.resolve(workspaceNodeModules, '@react-native/virtualized-lists'),
  expo: path.resolve(workspaceNodeModules, 'expo'),
  'react-dom': path.resolve(workspaceNodeModules, 'react-dom'),
};

module.exports = config;
