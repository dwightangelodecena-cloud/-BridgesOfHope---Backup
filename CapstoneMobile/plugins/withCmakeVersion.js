const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Pin every native module to a modern CMake.
 *
 * The CMake 3.22.1 bundled with the Android SDK hits an infinite
 * "ninja: error: manifest 'build.ninja' still dirty after 100 tries"
 * regeneration loop on Windows (expo-modules-core especially). 3.31.6 fixes it.
 *
 * Install `cmake;3.31.6` via Android Studio's SDK Manager (SDK Tools tab → show
 * package details) or:  sdkmanager "cmake;3.31.6"
 */
const CMAKE_VERSION = "3.31.6";

const SNIPPET = `
// withCmakeVersion — pin native builds to a Windows-safe CMake
subprojects { subproject ->
  ["com.android.library", "com.android.application"].each { pid ->
    subproject.plugins.withId(pid) {
      subproject.android {
        externalNativeBuild {
          cmake {
            version "${CMAKE_VERSION}"
          }
        }
      }
    }
  }
}
`;

module.exports = function withCmakeVersion(config) {
  // Windows-only workaround — EAS cloud builds run on Linux and don't have
  // this pinned CMake version installed, so leave those untouched.
  if (process.platform !== "win32") return config;

  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    let src = cfg.modResults.contents;
    if (src.includes("withCmakeVersion")) return cfg;

    // Must land BEFORE `apply plugin: "expo-root-project"` — autolinking eagerly
    // evaluates the module subprojects, after which cmake.version is read-only.
    const anchor = /^apply plugin: ["']expo-root-project["']/m;
    if (anchor.test(src)) {
      src = src.replace(anchor, (m) => `${SNIPPET}\n${m}`);
    } else {
      src = src.trimEnd() + "\n" + SNIPPET;
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
