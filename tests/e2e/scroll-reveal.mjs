/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);
function serve() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (!existsSync(filePath)) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type":
        contentTypes.get(extname(filePath)) || "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      "Chrome/Chromium not found. Set CHROME_BIN to the browser executable path.",
    );
  }
  return found;
}
const server = await serve();
const address = server.address();
if (!address || typeof address === "string") {
  server.close();
  throw new Error("Could not start local server.");
}
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  executablePath: findChrome(),
  headless: true,
  args: ["--disable-dev-shm-usage"],
});
async function setupPage(context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/css/components/scroll-reveal.css";
      link.onload = resolve;
      link.onerror = () =>
        reject(new Error("Failed to load scroll-reveal.css"));
      document.head.append(link);
    });
    const mod = await import("/assets/js/ui/scroll-reveal.js");
    mod.initScrollReveal();
    mod.initScrollReveal();
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  return { page, errors };
}
function cardOpacities(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".mode-card")].map((card) => {
      const value = Number.parseFloat(getComputedStyle(card).opacity);
      return Number.isFinite(value) ? value : 1;
    }),
  );
}
async function moveToCenter(page, selector, index = 0) {
  await page.evaluate(
    ({ selector, index }) => {
      const node = document.querySelectorAll(selector)[index];
      if (node)
        node.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "instant",
        });
    },
    { selector, index },
  );
  await page.waitForTimeout(900);
}
try {
  {
    const context = await browser.newContext({
      locale: "id-ID",
      viewport: { width: 420, height: 520 },
    });
    try {
      const { page, errors } = await setupPage(context);
      const timeline = await page.evaluate(() => ({
        view:
          typeof CSS !== "undefined" &&
          CSS.supports("animation-timeline: view()"),
        scroll:
          typeof CSS !== "undefined" &&
          CSS.supports("animation-timeline: scroll()"),
      }));
      console.log(`revealPath view=${timeline.view} scroll=${timeline.scroll}`);

      const count = await page.locator(".mode-card").count();
      if (count !== 3) throw new Error(`Expected 3 mode cards, got ${count}`);

      const before = await cardOpacities(page);
      console.log("cardsBeforeScroll", JSON.stringify(before));
      if (!before.some((value) => value < 0.9)) {
        throw new Error(
          `Mode cards should start hidden below the fold, got ${JSON.stringify(before)}`,
        );
      }
      console.log("PASS: mode cards start hidden with motion allowed");

      for (let index = 0; index < count; index += 1) {
        await moveToCenter(page, ".mode-card", index);
        const after = await cardOpacities(page);
        if (after[index] < 0.9) {
          throw new Error(
            `Mode card ${index} did not reveal (opacity ${after[index]})`,
          );
        }
      }
      console.log(
        "PASS: all mode cards become visible after scrolling into view",
      );
      const progress = await page.evaluate(() => {
        const bar = document.querySelector(".scroll-progress");
        if (!bar) return null;
        const style = getComputedStyle(bar);
        return {
          pointerEvents: style.pointerEvents,
          zIndex: Number(style.zIndex),
          hidden: bar.getAttribute("aria-hidden"),
        };
      });
      if (!progress) throw new Error("Scroll progress element is missing");
      if (progress.pointerEvents !== "none")
        throw new Error("Progress line must have pointer-events:none");
      if (progress.zIndex > 30)
        throw new Error(`Progress z-index too high: ${progress.zIndex}`);
      console.log(
        `PASS: progress line pointer-events=${progress.pointerEvents} z-index=${progress.zIndex}`,
      );
      if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);
      console.log("PASS: no page errors (motion allowed)");
      await page.locator(".mode-card").first().click();
      await page.waitForURL("**/single.html", { timeout: 30000 });
      if (!page.url().endsWith("single.html"))
        throw new Error("Mode card click did not navigate");
      console.log("PASS: progress line does not block mode-card clicks");
    } finally {
      await context.close();
    }
  }
  {
    const context = await browser.newContext({
      locale: "id-ID",
      viewport: { width: 420, height: 520 },
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        const native = CSS.supports.bind(CSS);
        CSS.supports = (...args) =>
          args.join(" ").includes("animation-timeline")
            ? false
            : native(...args);
      });
      await page.route(
        "**/assets/css/components/scroll-reveal.css",
        async (route) => {
          let css = await readFile(
            join(root, "assets/css/components/scroll-reveal.css"),
            "utf8",
          );
          css = css.replace(
            /@supports \(animation-timeline: view\(\)\) \{[\s\S]*?\n\}/,
            "",
          );
          css = css.replace(
            /@supports \(animation-timeline: scroll\(\)\) \{[\s\S]*?\n\}/,
            "",
          );
          await route.fulfill({
            contentType: "text/css; charset=utf-8",
            body: css,
          });
        },
      );
      await page.goto(`${base}/`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "/assets/css/components/scroll-reveal.css";
          link.onload = resolve;
          link.onerror = () => reject(new Error("Failed to load fallback CSS"));
          document.head.append(link);
        });
        const mod = await import("/assets/js/ui/scroll-reveal.js");
        mod.initScrollReveal();
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(120);

      await moveToCenter(page, ".mode-card", 0);
      const marker = await page
        .locator(".mode-card")
        .first()
        .evaluate((card) => card.classList.contains("is-visible"));
      const after = await cardOpacities(page);
      if (!marker || after[0] < 0.9)
        throw new Error(
          "IntersectionObserver fallback did not reveal the card",
        );
      console.log(
        "PASS: IntersectionObserver adds .is-visible when timelines are unsupported",
      );

      const barTransform = await page.evaluate(
        () => document.querySelector(".scroll-progress")?.style.transform || "",
      );
      if (!barTransform.startsWith("scaleX("))
        throw new Error("rAF scroll fallback did not update the progress bar");
      console.log(
        `PASS: passive scroll + rAF fallback drives progress (${barTransform})`,
      );

      if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);
      console.log("PASS: no page errors (fallback path)");
    } finally {
      await context.close();
    }
  }
  {
    const context = await browser.newContext({
      locale: "id-ID",
      reducedMotion: "reduce",
      viewport: { width: 420, height: 760 },
    });
    try {
      const { page, errors } = await setupPage(context);
      const state = await page.evaluate(() => ({
        opacities: [...document.querySelectorAll(".mode-card")].map((card) =>
          Number.parseFloat(getComputedStyle(card).opacity),
        ),
        ready: document.documentElement.classList.contains("js-reveal-ready"),
        progress: Boolean(document.querySelector(".scroll-progress")),
        visibleMarkers: document.querySelectorAll(".is-visible").length,
      }));
      if (state.opacities.some((value) => value < 0.99)) {
        throw new Error(
          `Reduced motion hid cards: ${JSON.stringify(state.opacities)}`,
        );
      }
      if (state.ready || state.progress || state.visibleMarkers) {
        throw new Error(
          `Reduced motion activated enhancement: ${JSON.stringify(state)}`,
        );
      }
      console.log("PASS: reduced motion keeps all cards visible immediately");
      const forced = await page.evaluate(() => {
        document.documentElement.classList.add("js-reveal-ready");
        return [...document.querySelectorAll(".mode-card")].map((card) =>
          Number.parseFloat(getComputedStyle(card).opacity),
        );
      });
      if (forced.some((value) => value < 0.99)) {
        throw new Error(
          `Reduced-motion CSS override failed: ${JSON.stringify(forced)}`,
        );
      }
      console.log("PASS: reduced-motion CSS overrides any forced reveal state");
      if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);
      console.log("PASS: no page errors (reduced motion)");
    } finally {
      await context.close();
    }
  }
  console.log("PASS: scroll-reveal e2e completed");
} finally {
  await browser.close();
  server.close();
}
