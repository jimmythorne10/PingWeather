const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAdiRegistration = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.resolve(
        config.modRequest.projectRoot,
        'assets',
        'adi-registration.properties'
      );
      const destDir = path.resolve(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'assets'
      );
      const dest = path.resolve(destDir, 'adi-registration.properties');

      if (!fs.existsSync(src)) {
        throw new Error(
          `withAdiRegistration: source file not found at ${src}`
        );
      }

      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      console.log(`[withAdiRegistration] Copied adi-registration.properties → ${dest}`);

      return config;
    },
  ]);
};

module.exports = withAdiRegistration;
