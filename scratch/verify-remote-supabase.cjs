const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env", "utf-8");
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.+)/);
const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const supabase = createClient(url, key);

async function testRemoteTables() {
  console.log("====================================================");
  console.log("       TESTING REMOTE SUPABASE PREMIUM SCHEMA       ");
  console.log("====================================================");
  console.log("Target URL:", url);
  console.log("Key Prefix:", key.slice(0, 15) + "...");

  const tables = [
    "journey_groups",
    "group_members",
    "group_invites",
    "location_shares",
    "location_updates",
    "stops", // known working GTFS table
  ];

  for (const table of tables) {
    console.log(`\nChecking table: public.${table}...`);
    const { data, error, status } = await supabase
      .from(table)
      .select("*")
      .limit(1);

    if (error) {
      console.log(`  [STATUS ${status}] Error code: ${error.code}`);
      console.log(`  Message: ${error.message}`);
      console.log(`  Details: ${error.details}`);
      console.log(`  Hint: ${error.hint}`);
    } else {
      console.log(
        `  [STATUS ${status}] Table EXISTS! Rows returned: ${data.length}`,
      );
    }
  }

  // Check RPC functions
  console.log("\nChecking RPC function: join_group_with_token...");
  const rpc1 = await supabase.rpc("join_group_with_token", {
    p_token: "test_token",
    p_user_id: "00000000-0000-0000-0000-000000000000",
  });
  if (rpc1.error) {
    console.log(
      `  [STATUS ${rpc1.status}] RPC Error: code=${rpc1.error.code}, message=${rpc1.error.message}`,
    );
  } else {
    console.log(`  RPC exists! Result:`, rpc1.data);
  }

  console.log("\nChecking RPC function: expire_stale_shares...");
  const rpc2 = await supabase.rpc("expire_stale_shares");
  if (rpc2.error) {
    console.log(
      `  [STATUS ${rpc2.status}] RPC Error: code=${rpc2.error.code}, message=${rpc2.error.message}`,
    );
  } else {
    console.log(`  RPC exists! Result:`, rpc2.data);
  }
}

testRemoteTables();
