const fs = require("fs");
const path = "C:/Users/DT User/Desktop/Portfolio/site/src/components/SpaceField.tsx";
let s = fs.readFileSync(path, "utf8");
const orig = s;

const earlyMarker = "let introFinished = !playIntroRef.current;";
if (!s.includes("BS1: early skip stub")) {
  if (!s.includes(earlyMarker)) throw new Error("early marker missing");
  s = s.replace(
    earlyMarker,
    earlyMarker +
      "\n\n    // BS1: early skip stub so PE forceComplete/Skip works even if WebGL setup throws.\n" +
      "    skipIntroRef.current = () => {\n" +
      "      if (introFinished) {\n" +
      "        return;\n" +
      "      }\n" +
      "      introFinished = true;\n" +
      "      handedOff = true;\n" +
      "      onHandoffRef.current();\n" +
      "      onIntroCompleteRef.current();\n" +
      "    };"
  );
}

const badWait =
  "      const root = splashRootRef.current;\n" +
  "      if (!root) {\n" +
  "        splashWaitFrame = window.requestAnimationFrame(startSplash);\n" +
  "        return;\n" +
  "      }";
const goodWait =
  "      const root = splashRootRef.current;\n" +
  "      if (!root) {\n" +
  "        // BS1: arm failsafe even when splash root is not attached yet.\n" +
  "        if (!failSafe) {\n" +
  "          failSafe = window.setTimeout(skipIntroNow, isMobile ? 7500 : 8500);\n" +
  "        }\n" +
  "        splashWaitFrame = window.requestAnimationFrame(startSplash);\n" +
  "        return;\n" +
  "      }";

if (s.includes(badWait)) {
  s = s.replace(badWait, goodWait);
} else if (!s.includes("arm failsafe even when splash root")) {
  throw new Error("startSplash wait block not found");
}

const oldFs =
  "      failSafe = window.setTimeout(skipIntroNow, isMobile ? 7500 : 8500);\n\n" +
  "      // Warm portrait";
const newFs =
  "      if (!failSafe) {\n" +
  "        failSafe = window.setTimeout(skipIntroNow, isMobile ? 7500 : 8500);\n" +
  "      }\n\n" +
  "      // Warm portrait";
if (s.includes(oldFs)) {
  s = s.replace(oldFs, newFs);
}

if (s === orig) {
  console.log("NO_CHANGE");
} else {
  fs.writeFileSync(path, s);
  console.log("PATCHED ok", "delta", s.length - orig.length);
}
