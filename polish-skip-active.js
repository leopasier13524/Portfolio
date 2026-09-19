const fs = require("fs");
const path = "src/components/MyRoadView.tsx";
let src = fs.readFileSync(path, "utf8");
// After Skip, activeIndex is 0 — ensure data-active stays on Graduation card
// (already setActiveIndex(0); verify data-active binding uses activeIndex)
if (!src.includes('data-active={index === activeIndex')) {
  // try common patterns
  src = src.replace(
    /data-active=\{[^}]+\}/,
    "data-active={index === activeIndex || undefined}"
  );
}
// Ensure skip sets active and doesn't leave last index
if (!/setActiveIndex\(0\)/.test(src) || /scrollHeight/.test(src)) {
  console.log("WARN skip still wrong");
}
fs.writeFileSync(path, src);
const snippet = (src.match(/data-active=\{[^}]+\}/) || ["NONE"])[0];
const skip = (src.match(/const skipFlight[\s\S]{0,280}/) || ["NONE"])[0];
console.log({ snippet, skipHasZero: /setActiveIndex\(0\)/.test(skip), skip });
