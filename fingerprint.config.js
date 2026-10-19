// What decides the OTA runtime (app.json runtimeVersion policy "fingerprint"):
// an update only reaches builds with the same native code. Expo's "balanced"
// preset, plus every npm script: editing lint or check scripts changes no
// native code, and would otherwise give the next update a runtime that no
// store build has, so it would silently reach nobody.
/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips: [
    // balanced
    "PackageJsonAndroidAndIosScriptsIfNotContainRun",
    "ExpoConfigVersions",
    "ExpoConfigRuntimeVersionIfString",
    "EasJson",
    "Easignore",
    "AutolinkingConfigPaths",
    // ours
    "PackageJsonScriptsAll",
  ],
};
