const fs = require("fs");
const pePath = "C:\\Users\\DT User\\Desktop\\Portfolio\\site\\src\\components\\PortfolioExperience.tsx";
const navPath = "C:\\Users\\DT User\\Desktop\\Portfolio\\site\\src\\components\\BottomNav.tsx";
const roadPath = "C:\\Users\\DT User\\Desktop\\Portfolio\\site\\src\\components\\MyRoadView.tsx";

let pe = fs.readFileSync(pePath, "utf8");
let nav = fs.readFileSync(navPath, "utf8");
let road = fs.readFileSync(roadPath, "utf8");

// --- Verify / ensure Skip stays at top ---
let skipOk = /setActiveIndex\(0\)[\s\S]{0,120}scrollTo\(\{\s*top:\s*0/.test(road)
  || /scrollTo\(\{\s*top:\s*0[\s\S]{0,80}setActiveIndex\(0\)/.test(road);
if (road.includes("scrollHeight") || /setActiveIndex\(myRoadStops\.length - 1\)/.test(road)) {
  road = road.replace(
    /const skipFlight = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/,
    `const skipFlight = useCallback(() => {
    flightTweenRef.current?.kill();
    flightTweenRef.current = null;
    setFlightSkipped(true);
    setActiveIndex(0);
    setScrub(0);
    placePlaneAtProgress(0);
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [placePlaneAtProgress]);`
  );
  skipOk = true;
}

// --- P0: raise BottomNav above My Road while open ---
// BottomNav: accept elevated className / z when myRoadOpen
if (!nav.includes("elevated")) {
  // add optional elevated prop
  if (nav.includes("hidden?: boolean")) {
    nav = nav.replace("hidden?: boolean;", "hidden?: boolean;\n  /** Raise above journey overlay so pointer exit works */\n  elevated?: boolean;");
  }
  // destructure
  nav = nav.replace(
    /export function BottomNav\(\{\n([\s\S]*?)hidden = false,\n\}/,
    (m, body) => {
      if (body.includes("elevated")) return m;
      return m.replace("hidden = false,", "hidden = false,\n  elevated = false,");
    }
  );
  // z-40 -> z-50 when elevated
  if (nav.includes("z-40")) {
    nav = nav.replace(
      /className=\{`([^`]*z-40[^`]*)`\}/,
      (full, cls) => {
        const next = cls.replace("z-40", "${elevated ? \"z-50\" : \"z-40\"}");
        return "className={`" + next + "`}";
      }
    );
  } else if (nav.includes("z-40")) {
    // already handled
  } else {
    // find fixed nav class string
    nav = nav.replace(
      /className=\{`(pointer-events-auto fixed[^`]*)`\}/,
      (full, cls) => {
        if (cls.includes("elevated")) return full;
        return "className={`" + cls + " ${elevated ? \"z-50\" : \"z-40\"}`}";
      }
    );
  }
}

// PE: pass elevated={myRoadOpen} to BottomNav; ensure nav stays visible while myRoadOpen
if (!pe.includes("elevated={myRoadOpen}")) {
  pe = pe.replace(
    /<BottomNav\n([\s\S]*?)\/>/,
    (block) => {
      if (block.includes("elevated=")) return block;
      return block.replace(
        "<BottomNav\n",
        "<BottomNav\n        elevated={myRoadOpen}\n"
      );
    }
  );
}

// Ensure BottomNav is NOT hidden when myRoadOpen (spec: nav exit)
pe = pe.replace(
  /hidden=\{!introDone \|\| projectOpen\}/,
  "hidden={!introDone || projectOpen}"
);
// If hidden also gates on myRoadOpen, remove that
pe = pe.replace(
  /hidden=\{!introDone \|\| projectOpen \|\| myRoadOpen\}/,
  "hidden={!introDone || projectOpen}"
);

// MyRoad dialog: leave bottom chrome reachable — shorten overlay so it doesn't claim bottom nav hit area
// Also ensure z-45 stays but pointer-events don't block nav: add pb safe area and clip overlay above nav
if (road.includes('z-[45]') && !road.includes("data-myroad-overlay")) {
  road = road.replace(
    'className="fixed inset-0 z-[45] flex flex-col bg-black text-white"',
    'className="fixed inset-0 z-[45] flex flex-col bg-black text-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-28" data-myroad-overlay'
  );
}

fs.writeFileSync(roadPath, road);
fs.writeFileSync(navPath, nav);
fs.writeFileSync(pePath, pe);

console.log(JSON.stringify({
  skipOk,
  skipHasScrollHeight: road.includes("scrollHeight"),
  skipSnippet: (road.match(/const skipFlight[\s\S]{0,380}/) || ["MISSING"])[0],
  navElevatedProp: nav.includes("elevated"),
  navZToggle: nav.includes('elevated ? "z-50"') || nav.includes("elevated ? 'z-50'"),
  peElevated: pe.includes("elevated={myRoadOpen}"),
  peHidden: (pe.match(/<BottomNav[\s\S]{0,280}/) || ["MISSING"])[0],
  roadPb: road.includes("pb-[calc(5.5rem"),
}, null, 2));
