const fs = require("fs");
const css = fs.readFileSync("src/app/globals.css", "utf8");
const home = fs.readFileSync("src/components/HomeView.tsx", "utf8");
const start = css.indexOf(".ac-home-field__glow");
console.log(css.slice(start, start + 1200));
console.log("---HOME STRUCTURE---");
const m = home.match(/return \([\s\S]*$/);
console.log(m ? m[0].slice(0, 2200) : "no");
