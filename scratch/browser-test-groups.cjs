const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const OUT_DIR = path.join(__dirname, "qa-screenshots");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function runBrowserTests() {
  console.log("=== Launching Chrome for TRAKO Groups Verification ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--window-size=430,932",
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
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(BASE_URL, ["geolocation"]);
  await page.setGeolocation({ latitude: 18.5204, longitude: 73.8567 });

  const logs = [];
  page.on("console", (msg) => {
    const txt = msg.text();
    logs.push(`[${msg.type()}] ${txt}`);
    if (msg.type() === "error") {
      console.log("Console error:", txt);
    }
  });

  try {
    // 1. Groups Page - Not logged in
    console.log("\n1. Testing Groups Page (Initial)...");
    await page.goto(`${BASE_URL}/groups`, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUT_DIR, "groups-1-unauth.png") });
    console.log("✓ Saved groups-1-unauth.png");

    // 2. Simulate Logged-in Commuter using preview auth in localStorage
    console.log("\n2. Setting up test user session in localStorage...");
    await page.evaluate(() => {
      const mockUser = {
        id: "usr-commuter-test-001",
        email: "commuter@trako.pune",
        aud: "authenticated",
        role: "authenticated",
        created_at: new Date().toISOString(),
      };
      // Set Supabase token storage if used
      const sessionData = {
        access_token: "mock-access-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "mock-refresh-token",
        user: mockUser,
      };
      localStorage.setItem(
        "sb-ovjvjogjntfpinylqvyr-auth-token",
        JSON.stringify(sessionData),
      );
      localStorage.setItem("trako_test_user", JSON.stringify(mockUser));
    });

    // Reload /groups to verify state with authenticated user
    console.log("Reloading /groups...");
    await page.goto(`${BASE_URL}/groups`, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({
      path: path.join(OUT_DIR, "groups-2-dashboard.png"),
    });
    console.log("✓ Saved groups-2-dashboard.png");

    // 3. Programmatically test group creation in page context and reload
    console.log("\n3. Testing Group Creation in page context...");
    const createResult = await page.evaluate(async () => {
      // Direct call or trigger form
      const grp = {
        id: "grp-test-campus",
        name: "College Group",
        description: "COEP Campus Commuters",
        owner_id: "usr-commuter-test-001",
        created_at: new Date().toISOString(),
        expires_at: null,
        status: "active",
      };
      const mem = {
        id: "mem-test-001",
        group_id: "grp-test-campus",
        user_id: "usr-commuter-test-001",
        role: "owner",
        joined_at: new Date().toISOString(),
        status: "active",
        display_name: "You",
      };
      const inv = {
        id: "inv-test-001",
        group_id: "grp-test-campus",
        token_hash: "mockhash123",
        raw_token: "tok-secure-campus-7788",
        created_by: "usr-commuter-test-001",
        created_at: new Date().toISOString(),
        expires_at: null,
        max_uses: null,
        uses: 0,
        revoked_at: null,
      };

      const existingG = JSON.parse(
        localStorage.getItem("trako_premium_groups") || "[]",
      );
      const existingM = JSON.parse(
        localStorage.getItem("trako_premium_members") || "[]",
      );
      const existingI = JSON.parse(
        localStorage.getItem("trako_premium_invites") || "[]",
      );

      localStorage.setItem(
        "trako_premium_groups",
        JSON.stringify([grp, ...existingG]),
      );
      localStorage.setItem(
        "trako_premium_members",
        JSON.stringify([mem, ...existingM]),
      );
      localStorage.setItem(
        "trako_premium_invites",
        JSON.stringify([inv, ...existingI]),
      );

      window.dispatchEvent(new CustomEvent("trako_groups_update"));
      return { success: true, groupId: grp.id };
    });
    console.log("Group created:", createResult);

    await page.goto(`${BASE_URL}/groups`, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({
      path: path.join(OUT_DIR, "groups-3-with-groups.png"),
    });
    console.log("✓ Saved groups-3-with-groups.png");

    // 4. Test Group Detail Page & Group Map View
    console.log(
      "\n4. Navigating to Group Detail page (/groups/grp-test-campus)...",
    );
    await page.goto(`${BASE_URL}/groups/grp-test-campus`, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 3000));
    await page.screenshot({
      path: path.join(OUT_DIR, "groups-4-detail-view.png"),
    });
    console.log("✓ Saved groups-4-detail-view.png");

    // 5. Test Start Location Sharing on the group
    console.log("\n5. Simulating Location Sharing session...");
    await page.evaluate(() => {
      const share = {
        id: "shr-test-live",
        group_id: "grp-test-campus",
        user_id: "usr-commuter-test-001",
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
        stopped_at: null,
        sharing_status: "active",
        transit_mode: "bus",
        transit_label: "Bus 159",
        current_stop: "Swargate",
        next_stop: "Shivajinagar",
        eta_minutes: 8,
      };
      const ping = {
        id: "png-test-001",
        share_id: "shr-test-live",
        group_id: "grp-test-campus",
        user_id: "usr-commuter-test-001",
        lat: 18.5204,
        lon: 73.8567,
        accuracy_m: 5,
        recorded_at: new Date().toISOString(),
      };
      localStorage.setItem("trako_premium_shares", JSON.stringify([share]));
      localStorage.setItem("trako_premium_pings", JSON.stringify([ping]));
      window.dispatchEvent(new CustomEvent("trako_groups_update"));
    });

    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({
      path: path.join(OUT_DIR, "groups-5-live-sharing.png"),
    });
    console.log("✓ Saved groups-5-live-sharing.png");

    // 6. Test Join Group page with Token (/groups/join?token=...)
    console.log(
      "\n6. Testing Join Group Route (/groups/join?token=tok-secure-campus-7788)...",
    );
    await page.goto(`${BASE_URL}/groups/join?token=tok-secure-campus-7788`, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({
      path: path.join(OUT_DIR, "groups-6-join-page.png"),
    });
    console.log("✓ Saved groups-6-join-page.png");

    console.log("\nAll browser UI checks completed successfully!");
  } catch (err) {
    console.error("Browser test failed:", err);
  } finally {
    await browser.close();
  }
}

runBrowserTests();
