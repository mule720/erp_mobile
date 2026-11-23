/**
 * Marks hardware the app can live without as optional in the Android manifest.
 *
 * Why: the app is locked to portrait ("orientation": "portrait"), and the camera and location permissions are declared. Google Play
 * reads those and treats portrait, camera, autofocus and GPS as REQUIRED features, which hides the app from tablets, desktops,
 * Android XR and other devices without them ("Required hardware feature declarations are restricting your app's availability").
 * An explicit <uses-feature android:required="false"> overrides what Play would otherwise infer. Portrait stays the orientation
 * on phones; the camera is only needed for picture search and scanning, and a photo can be picked instead; location is only
 * for "near me" and delivery.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL_FEATURES = [
  'android.hardware.screen.portrait',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.touchscreen',
];

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] || [];
    for (const name of OPTIONAL_FEATURES) {
      const existing = manifest['uses-feature'].find(f => f.$ && f.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
