const fs = require("fs");
const field = fs.readFileSync("src/components/AcHomeField.tsx", "utf8");
const home = fs.readFileSync("src/components/HomeView.tsx", "utf8");
const css = fs.readFileSync("src/app/globals.css", "utf8");
fs.writeFileSync("_inspect_field.txt", field);
fs.writeFileSync("_inspect_home_snip.txt", home.slice(0, 2500));
console.log("FIELD_LEN", field.length);
console.log("FIELD_TAIL\n", field.slice(-1800));
console.log("---HOME FIELD USE---");
const i = home.indexOf("AcHomeField");
console.log(home.slice(Math.max(0, i - 200), i + 400));
console.log("---CSS AC---");
for (const line of css.split(/\n/)) {
  if (/ac-home|ac_home|home-field/i.test(line)) console.log(line);
}
