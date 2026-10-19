const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
// Optional development tool: Playwright is deliberately not a game dependency.
// Use isolated browsers, real UI input, and read-only game diagnostics.
const fs = require("node:fs/promises");
const out = process.argv[2],
  base = process.argv[3];
if (!out || !base)
  throw new Error(
    "Usage: node scripts/benchmark-browser.cjs <output-prefix> <preview-url> [all|desktop|mobile|cold]",
  );
const modes = process.argv[4] || "all";
(async () => {
  const b = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "chrome",
    headless: true,
  });
  const results = [];
  try {
    for (const kind of modes === "all"
      ? ["desktop", "mobile"]
      : modes === "cold"
        ? ["desktop"]
        : modes.split(",")) {
      const ctx = await b.newContext({
        viewport:
          kind === "mobile"
            ? { width: 390, height: 844 }
            : { width: 1440, height: 900 },
        deviceScaleFactor: kind === "mobile" ? 2 : 1,
        isMobile: kind === "mobile",
        hasTouch: kind === "mobile",
        locale: "en-US",
      });
      const p = await ctx.newPage();
      const cdp = await ctx.newCDPSession(p);
      await cdp.send("Performance.enable");
      if (kind === "mobile")
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      // Configure a local page-target CDP stress test, not a device/router-level throttle.
      // Main-page resource timing excludes worker assets; response events include them.
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 60,
        downloadThroughput: 2 * 1024 * 1024,
        uploadThroughput: 1024 * 1024,
      });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      const resources = [];
      ctx.on("response", (r) =>
        resources.push({
          url: r.url(),
          status: r.status(),
          serviceWorker: !!r.request().serviceWorker(),
          headers: r.headers(),
          at: Date.now(),
        }),
      );
      await p.addInitScript(() => {
        window.__perf = { frames: [], tasks: [], mutations: 0 };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            __perf.tasks.push({ start: e.startTime, duration: e.duration });
        }).observe({ type: "longtask", buffered: true });
        new MutationObserver((ms) => {
          __perf.mutations += ms.length;
        }).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        let prev;
        function sample(t) {
          if (prev !== undefined) __perf.frames.push({ at: t, dt: t - prev });
          prev = t;
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      const start = Date.now();
      await p.goto(base + "?lang=en", { waitUntil: "domcontentloaded" });
      await p.locator("#player-name").fill("Performance");
      const entry = Date.now() - start;
      await p.locator("#enter").click();
      await p.waitForFunction(
        () => window.microduck?.state?.players.length === 4,
        null,
        { timeout: 120000 },
      );
      const ready = Date.now() - start;
      console.log(kind, "ready", ready);
      if (modes === "cold") {
        results.push({ kind, entry, ready, errors });
        await ctx.close();
        continue;
      }
      await p.waitForFunction(
        () => microduck.state.match.phase === "playing",
        null,
        { timeout: 30000 },
      );
      await p.locator("#keys > summary").click();
      await p.locator("#sound").click();
      await p.locator("#autoplay").click();
      await p.locator("#keys > summary").click();
      const stages = {};
      for (const scene of ["moon-base", "little-world"]) {
        if (scene === "little-world")
          await p.locator('[data-scene="little-world"]').click();
        await p.waitForTimeout(1500);
        await p.evaluate(() => {
          __perf.frames = [];
          __perf.tasks = [];
          __perf.mutations = 0;
        });
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.start");
        const m1 = await cdp.send("Performance.getMetrics");
        const t1 = Date.now();
        await p.waitForTimeout(10000);
        const elapsed = Date.now() - t1;
        const m2 = await cdp.send("Performance.getMetrics");
        const profile = await cdp.send("Profiler.stop");
        await fs.writeFile(
          out + "." + kind + "." + scene + ".cpuprofile",
          JSON.stringify(profile.profile),
        );
        const stats = await p.evaluate(() => ({
          frames: __perf.frames,
          tasks: __perf.tasks,
          mutations: __perf.mutations,
          render: {
            ...microduck.renderer.info.render,
            memory: { ...microduck.renderer.info.memory },
          },
          engine: microduck.state.engine,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        const dt = stats.frames.map((x) => x.dt).sort((a, b) => a - b);
        const metrics = {};
        for (const name of [
          "TaskDuration",
          "ScriptDuration",
          "LayoutDuration",
          "RecalcStyleDuration",
          "LayoutCount",
          "RecalcStyleCount",
          "JSHeapUsedSize",
        ]) {
          metrics[name] =
            m2.metrics.find((m) => m.name === name)?.value -
            (name === "JSHeapUsedSize"
              ? 0
              : m1.metrics.find((m) => m.name === name)?.value);
        }
        stages[scene] = {
          elapsed,
          frames: dt.length,
          fps: dt.length / (elapsed / 1000),
          frameP50: dt[Math.floor(dt.length * 0.5)],
          frameP95: dt[Math.floor(dt.length * 0.95)],
          over33: dt.filter((x) => x > 33.4).length,
          longTasks: stats.tasks.length,
          mutations: stats.mutations,
          render: stats.render,
          engine: stats.engine,
          overflow: stats.overflow,
          metrics,
        };
        await p.screenshot({
          path: out + "." + kind + "." + scene + ".jpg",
          quality: 85,
        });
        console.log(kind, scene, JSON.stringify(stages[scene]));
      }
      const rs = await p.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((r) => ({
            name: r.name,
            size: r.transferSize,
            decoded: r.decodedBodySize,
            duration: r.duration,
            start: r.startTime,
          })),
      );
      results.push({
        kind,
        entry,
        ready,
        resources: rs,
        requests: resources,
        stages,
        errors,
      });
      await ctx.close();
    }
    await fs.writeFile(out + ".json", JSON.stringify(results, null, 2));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
