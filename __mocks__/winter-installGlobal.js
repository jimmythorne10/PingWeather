// No-op installGlobal so runtime.native.ts doesn't install lazy polyfills
// that later try to require files outside Jest's test scope.
module.exports = {
  installGlobal: () => {},
};
