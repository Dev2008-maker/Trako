const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const OUT_DIR = path.join(__dirname, "qa-screenshots");

async function run() {
  console.log("=== Starting Real Runtime QA Verification ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--window-size=430,932", // Mobile viewport for mobile-first transit app
    ],
    defaultViewport: {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  });

  const page = await browser.newPage();

  // Emulate Pune Geolocation
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(BASE_URL, ["geolocation"]);
  await page.setGeolocation({ latitude: 18.5204, longitude: 73.8567 });

  const errors = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      msg.type() === "error" ||
      text.includes("error") ||
      text.includes("Error")
    ) {
      console.log("[BROWSER_LOG]", msg.type(), text);
    }
    if (
      text.includes("Failed to fetch") ||
      text.includes("ENOTFOUND") ||
      text.includes("PGRST")
    ) {
      errors.push(text);
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      const errStr = `HTTP ${res.status()} on ${res.url()}`;
      console.log("[HTTP_ERROR]", errStr);
      errors.push(errStr);
    }
  });

  page.on("pageerror", (err) => {
    console.log("[PAGE_ERROR]", err.message);
    errors.push(err.message);
  });

  try {
    // 1. Home Screen
    console.log("\n--- 1. Testing Home Screen ---");
    await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({
      path: path.join(OUT_DIR, "1-home-screen.png"),
      fullPage: false,
    });
    console.log("✓ Captured 1-home-screen.png");

    // 2. Nearby Stops
    console.log("\n--- 2. Testing Nearby Stops ---");
    await page.goto(`${BASE_URL}/nearby`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({
      path: path.join(OUT_DIR, "2-nearby-stops.png"),
      fullPage: false,
    });
    console.log("✓ Captured 2-nearby-stops.png");

    // 4. Nearby Buses (same page, scroll down to see buses under stops)
    console.log("\n--- 4. Testing Nearby Buses ---");
    await page.screenshot({
      path: path.join(OUT_DIR, "4-nearby-buses.png"),
      fullPage: false,
    });
    console.log("✓ Captured 4-nearby-buses.png");

    // 3. Upcoming Buses (Stop 319 - Income Tax Office)
    console.log("\n--- 3. Testing Upcoming Buses (Stop 319) ---");
    await page.goto(`${BASE_URL}/stop/319`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({
      path: path.join(OUT_DIR, "3-upcoming-buses.png"),
      fullPage: false,
    });
    console.log("✓ Captured 3-upcoming-buses.png");

    // 5. Routes
    console.log("\n--- 5. Testing Routes List ---");
    await page.goto(`${BASE_URL}/routes`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({
      path: path.join(OUT_DIR, "5-routes-list.png"),
      fullPage: false,
    });
    console.log("✓ Captured 5-routes-list.png");

    // 6. Route Details (Route 108)
    console.log("\n--- 6. Testing Route Details (Route 108) ---");
    await page.goto(`${BASE_URL}/routes/108`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({
      path: path.join(OUT_DIR, "6-route-details.png"),
      fullPage: false,
    });
    console.log("✓ Captured 6-route-details.png");
  } catch (e) {
    console.error("QA execution error:", e);
  } finally {
    await browser.close();
  }

  console.log("\n=== Error Summary ===");
  if (errors.length === 0) {
    console.log(
      "NO critical errors detected (no Failed to fetch, ENOTFOUND, 401, 403, or PGRST).",
    );
  } else {
    console.log("Errors caught during run:", errors);
  }
}

run();
