const fs = require("fs");
const path = "C:\\Users\\DT User\\Desktop\\Portfolio\\site\\src\\components\\MyRoadView.tsx";
let src = fs.readFileSync(path, "utf8");

// P0: Skip kills flight but stays at top so Graduation is ATF
const skipPatterns = [
  // common pattern from our land
  /const skipFlight = useCallback\(\(\) => \{[\s\S]*?\}, \[placePlaneAtProgress\]\);/,
  /const skipFlight = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/,
];

let replaced = false;
for (const re of skipPatterns) {
  if (re.test(src)) {
    src = src.replace(
      re,
      `const skipFlight = useCallback(() => {
    flightTweenRef.current?.kill();
    flightTweenRef.current = null;
    setFlightSkipped(true);
    // Keep the full arc readable from the top — do NOT jump to the end.
    setActiveIndex(0);
    setScrub(0);
    placePlaneAtProgress(0);
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [placePlaneAtProgress]);`
    );
    replaced = true;
    break;
  }
}

// Also catch any scrollHeight jump leftovers
if (src.includes("scrollHeight")) {
  src = src.replace(
    /scroller\.scrollTo\(\{\s*top:\s*scroller\.scrollHeight,\s*behavior:\s*"auto"\s*\}\);/g,
    'scroller.scrollTo({ top: 0, behavior: "auto" });'
  );
  src = src.replace(
    /setActiveIndex\(myRoadStops\.length - 1\);\s*setScrub\(1\);\s*placePlaneAtProgress\(1\);/g,
    "setActiveIndex(0);\n    setScrub(0);\n    placePlaneAtProgress(0);"
  );
  replaced = true;
}

// Polish #3: Upwork role → UI/UX Designer (content file)
const portfolioPath = "C:\\Users\\DT User\\Desktop\\Portfolio\\site\\src\\content\\portfolio.ts";
let portfolio = fs.readFileSync(portfolioPath, "utf8");
portfolio = portfolio.replace(
  /(id:\s*"upwork"[\s\S]*?role:\s*")UI\/UX(")/,
  "$1UI/UX Designer$2"
);

// Polish #3: scrub pills show stop titles truncated? CoS wants numbers not stop names — ensure buttons render index+1 only
// (already numeric in our land; if titles appear, fix)
src = src.replace(
  /\{stop\.title\}(?=[\s\S]{0,80}jumpToStop)/g,
  "{index + 1}"
);

// Follow-up #2: hide skill rail under md
src = src.replace(
  /className="pointer-events-none absolute inset-x-0 top-16 bottom-24 flex flex-col items-center justify-between py-6"/,
  'className="pointer-events-none absolute inset-x-0 top-16 bottom-24 hidden flex-col items-center justify-between py-6 md:flex"'
);
// icons-only on md if labels still show — hide 7px labels on smaller by already hiding rail under md

fs.writeFileSync(path, src);
fs.writeFileSync(portfolioPath, portfolio);
console.log(JSON.stringify({
  skipReplaced: replaced,
  hasScrollHeight: src.includes("scrollHeight"),
  skipSnippet: (src.match(/const skipFlight[\s\S]{0,420}/) || ["MISSING"])[0],
  upworkRole: (portfolio.match(/id: "upwork"[\s\S]{0,120}/) || ["MISSING"])[0],
  railHidden: src.includes("hidden flex-col items-center justify-between py-6 md:flex"),
}));
