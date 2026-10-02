const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env", "utf-8");
const url = env.match(/VITE_SUPABASE_URL\s*=\s*(.+)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.+)/)[1].trim();

const supabaseA = createClient(url, key);
const supabaseB = createClient(url, key);

async function runTests() {
  console.log("=== 1. TEST REMOTE SUPABASE AUTH & PERMISSIONS ===");
  const testEmailA = `trako_user_a_${Date.now()}@test.com`;
  const testEmailB = `trako_user_b_${Date.now()}@test.com`;
  const password = "TestPassword123!@#";

  console.log("Attempting sign up User A:", testEmailA);
  const signUpA = await supabaseA.auth.signUp({
    email: testEmailA,
    password,
  });

  if (signUpA.error) {
    console.log("Sign up User A error:", signUpA.error.message);
  } else {
    console.log("User A signed up successfully. UID:", signUpA.data.user?.id);
  }

  console.log("\nAttempting sign up User B:", testEmailB);
  const signUpB = await supabaseB.auth.signUp({
    email: testEmailB,
    password,
  });

  if (signUpB.error) {
    console.log("Sign up User B error:", signUpB.error.message);
  } else {
    console.log("User B signed up successfully. UID:", signUpB.data.user?.id);
  }

  console.log(
    "\n=== 2. ATTEMPT INSERT TO REMOTE journey_groups WITH AUTHENTICATED USER A ===",
  );
  if (signUpA.data.user) {
    const insertRes = await supabaseA
      .from("journey_groups")
      .insert({
        name: "College Group",
        description: "College campus commute",
        owner_id: signUpA.data.user.id,
        status: "active",
      })
      .select();

    console.log("Insert journey_groups result:", {
      status: insertRes.status,
      error: insertRes.error
        ? {
            code: insertRes.error.code,
            message: insertRes.error.message,
            details: insertRes.error.details,
            hint: insertRes.error.hint,
          }
        : null,
      data: insertRes.data,
    });
  }

  console.log("\n=== 3. ATTEMPT INSERT TO REMOTE group_members ===");
  if (signUpA.data.user) {
    const memberRes = await supabaseA
      .from("group_members")
      .insert({
        group_id: "00000000-0000-0000-0000-000000000000",
        user_id: signUpA.data.user.id,
        role: "owner",
        status: "active",
      })
      .select();

    console.log("Insert group_members result:", {
      status: memberRes.status,
      error: memberRes.error
        ? {
            code: memberRes.error.code,
            message: memberRes.error.message,
          }
        : null,
    });
  }
}

runTests();
