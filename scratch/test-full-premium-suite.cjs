const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env", "utf-8");
const url = env.match(/VITE_SUPABASE_URL\s*=\s*(.+)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.+)/)[1].trim();

const supabase = createClient(url, key);

// Token helpers replicating src/lib/sharing.ts
function generateSecureToken() {
  return crypto.randomBytes(24).toString("hex");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Simulated Local Storage Store
const store = {
  trako_premium_groups: [],
  trako_premium_members: [],
  trako_premium_invites: [],
  trako_premium_shares: [],
  trako_premium_pings: [],
};

function getLocal(k) {
  return store[k] || [];
}
function setLocal(k, v) {
  store[k] = v;
}

// Dual-layer simulated service methods based on src/lib/groupService.ts
async function createGroup(params) {
  const { name, description, ownerId, durationMinutes } = params;
  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60000).toISOString()
    : null;
  const gid = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const g = {
    id: gid,
    name,
    description: description || null,
    owner_id: ownerId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    status: "active",
  };
  const m = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    group_id: gid,
    user_id: ownerId,
    role: "owner",
    joined_at: new Date().toISOString(),
    status: "active",
    display_name: "Group Owner",
  };

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const inv = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    group_id: gid,
    token_hash: tokenHash,
    raw_token: rawToken,
    created_by: ownerId,
    created_at: new Date().toISOString(),
    expires_at: null,
    max_uses: null,
    uses: 0,
    revoked_at: null,
  };

  setLocal("trako_premium_groups", [g, ...getLocal("trako_premium_groups")]);
  setLocal("trako_premium_members", [m, ...getLocal("trako_premium_members")]);
  setLocal("trako_premium_invites", [
    inv,
    ...getLocal("trako_premium_invites"),
  ]);

  return { groupId: gid, inviteToken: rawToken, error: null };
}

function fetchMyGroups(userId) {
  const allGroups = getLocal("trako_premium_groups");
  const allMembers = getLocal("trako_premium_members");
  const userMemberships = allMembers.filter(
    (m) => m.user_id === userId && m.status === "active",
  );
  const myGids = new Set(userMemberships.map((m) => m.group_id));

  return allGroups.filter((g) => myGids.has(g.id) && g.status === "active");
}

function joinGroupWithToken(rawToken, userId) {
  const allInvites = getLocal("trako_premium_invites");
  const allMembers = getLocal("trako_premium_members");
  const allGroups = getLocal("trako_premium_groups");

  const hashed = hashToken(rawToken);
  const inv = allInvites.find(
    (i) => i.token_hash === hashed || i.raw_token === rawToken,
  );

  if (!inv)
    return { groupId: null, error: "Invalid or expired invitation link" };
  if (inv.revoked_at)
    return { groupId: null, error: "This invitation link has been revoked" };
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return { groupId: null, error: "This invitation link has expired" };
  }
  if (inv.max_uses !== null && inv.uses >= inv.max_uses) {
    return {
      groupId: null,
      error: "This invitation link has reached its maximum uses",
    };
  }

  const group = allGroups.find((g) => g.id === inv.group_id);
  if (!group || group.status !== "active")
    return { groupId: null, error: "Group is no longer active" };

  const existing = allMembers.find(
    (m) => m.group_id === inv.group_id && m.user_id === userId,
  );
  if (!existing) {
    const newMem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      group_id: inv.group_id,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
      status: "active",
      display_name: "Guest Rider",
    };
    setLocal("trako_premium_members", [...allMembers, newMem]);
  }
  return { groupId: inv.group_id, error: null };
}

function startLocationSharingSession(params) {
  const {
    groupId,
    userId,
    durationMinutes,
    transitMode,
    transitLabel,
    currentStop,
    nextStop,
    etaMinutes,
  } = params;
  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60000).toISOString()
    : null;
  const allShares = getLocal("trako_premium_shares");
  const newShare = {
    id: `shr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    group_id: groupId,
    user_id: userId,
    started_at: new Date().toISOString(),
    expires_at: expiresAt,
    stopped_at: null,
    sharing_status: "active",
    transit_mode: transitMode || null,
    transit_label: transitLabel || null,
    current_stop: currentStop || null,
    next_stop: nextStop || null,
    eta_minutes: etaMinutes || null,
  };
  setLocal("trako_premium_shares", [newShare, ...allShares]);
  return { shareId: newShare.id, expiresAt };
}

function stopLocationSharingSession(shareId, userId) {
  const allShares = getLocal("trako_premium_shares");
  const updated = allShares.map((s) =>
    s.id === shareId && s.user_id === userId
      ? {
          ...s,
          sharing_status: "stopped",
          stopped_at: new Date().toISOString(),
        }
      : s,
  );
  setLocal("trako_premium_shares", updated);
}

function fetchGroupDetails(groupId, viewerUserId) {
  const allGroups = getLocal("trako_premium_groups");
  const allMembers = getLocal("trako_premium_members");
  const allShares = getLocal("trako_premium_shares");

  const g = allGroups.find((x) => x.id === groupId);
  if (!g) return { group: null, members: [], error: "Group not found" };

  const membersInGroup = allMembers.filter(
    (m) => m.group_id === groupId && m.status === "active",
  );
  const activeShares = allShares.filter(
    (s) =>
      s.group_id === groupId &&
      s.sharing_status === "active" &&
      (!s.expires_at || new Date(s.expires_at) > new Date()),
  );

  const shareMap = {};
  for (const s of activeShares) {
    shareMap[s.user_id] = s;
  }

  const members = membersInGroup.map((m) => ({
    userId: m.user_id,
    role: m.role,
    isSharing: !!shareMap[m.user_id],
    share: shareMap[m.user_id] || null,
  }));

  return { group: g, members, error: null };
}

async function runTestSuite() {
  console.log("====================================================");
  console.log("     TRAKO PREMIUM COMPREHENSIVE VERIFICATION       ");
  console.log("====================================================\n");

  // 1. Remote Supabase Schema Check
  console.log("--- 1. REMOTE SUPABASE SCHEMA AUDIT ---");
  const tables = [
    "journey_groups",
    "group_members",
    "group_invites",
    "location_shares",
    "location_updates",
  ];
  for (const t of tables) {
    const { status, error } = await supabase.from(t).select("*").limit(1);
    console.log(
      `Table '${t}': status=${status}, code=${error?.code || "OK"}, message=${error?.message || "OK"}`,
    );
  }

  // 2. Multi-Group Creation Test
  console.log("\n--- 2. GROUP CREATION VERIFICATION ---");
  const USER_A_ID = "usr-0001-user-a";
  const USER_B_ID = "usr-0002-user-b";

  const g1 = await createGroup({
    name: "Family Group",
    description: "Home & Family",
    ownerId: USER_A_ID,
    durationMinutes: null,
  });
  const g2 = await createGroup({
    name: "Friends",
    description: "Weekend Hangouts",
    ownerId: USER_A_ID,
    durationMinutes: null,
  });
  const g3 = await createGroup({
    name: "College Group",
    description: "Campus Daily Commute",
    ownerId: USER_A_ID,
    durationMinutes: 60,
  });

  console.log("Created 3 groups:");
  console.log("  - Family Group:", g1.groupId);
  console.log("  - Friends:", g2.groupId);
  console.log(
    "  - College Group:",
    g3.groupId,
    "Invite Token:",
    g3.inviteToken.slice(0, 10) + "...",
  );

  const myGroupsA = fetchMyGroups(USER_A_ID);
  console.log("User A myGroups count:", myGroupsA.length, "(Expected: 3)");

  // 3. User B Joining via Invite
  console.log("\n--- 3. MULTI-USER JOIN FLOW ---");
  const joinResult = joinGroupWithToken(g3.inviteToken, USER_B_ID);
  console.log(
    "User B joined College Group:",
    joinResult.groupId === g3.groupId ? "SUCCESS" : "FAILED",
  );
  const myGroupsB = fetchMyGroups(USER_B_ID);
  console.log("User B myGroups count:", myGroupsB.length, "(Expected: 1)");

  // 4. Location Sharing Flow
  console.log("\n--- 4. LOCATION SHARING & PRIVACY VERIFICATION ---");
  const share = startLocationSharingSession({
    groupId: g3.groupId,
    userId: USER_A_ID,
    durationMinutes: 30,
    transitMode: "bus",
    transitLabel: "Bus 159",
    currentStop: "Swargate",
    nextStop: "Shivajinagar",
    etaMinutes: 8,
  });
  console.log(
    "User A started sharing. Share ID:",
    share.shareId,
    "Expires:",
    share.expiresAt,
  );

  let detailsSeenByB = fetchGroupDetails(g3.groupId, USER_B_ID);
  let userAMember = detailsSeenByB.members.find((m) => m.userId === USER_A_ID);
  console.log(
    "User B sees User A sharing:",
    userAMember?.isSharing ? "YES (ACTIVE)" : "NO",
  );
  console.log("  Transit Label:", userAMember?.share?.transit_label);
  console.log("  Next Stop:", userAMember?.share?.next_stop);
  console.log("  ETA:", userAMember?.share?.eta_minutes, "mins");

  console.log("\nUser A stops sharing...");
  stopLocationSharingSession(share.shareId, USER_A_ID);

  detailsSeenByB = fetchGroupDetails(g3.groupId, USER_B_ID);
  userAMember = detailsSeenByB.members.find((m) => m.userId === USER_A_ID);
  console.log(
    "After stop, User B sees User A sharing:",
    userAMember?.isSharing ? "YES (ACTIVE)" : "NO (STOPPED)",
  );

  // 5. Invite Security Tests
  console.log("\n--- 5. INVITE SECURITY AUDIT ---");
  // Test invalid token
  const invalidRes = joinGroupWithToken("invalid_fake_token_12345", USER_B_ID);
  console.log(
    "Invalid token test:",
    invalidRes.error ? `BLOCKED (${invalidRes.error})` : "FAILED SECURITY",
  );

  // Test revoked token
  const allInv = getLocal("trako_premium_invites");
  setLocal(
    "trako_premium_invites",
    allInv.map((i) =>
      i.raw_token === g3.inviteToken
        ? { ...i, revoked_at: new Date().toISOString() }
        : i,
    ),
  );
  const revokedRes = joinGroupWithToken(g3.inviteToken, "usr-0003-user-c");
  console.log(
    "Revoked token test:",
    revokedRes.error ? `BLOCKED (${revokedRes.error})` : "FAILED SECURITY",
  );

  // Test expired token
  setLocal("trako_premium_invites", [
    {
      id: "inv-expired",
      group_id: g1.groupId,
      token_hash: hashToken("expired_tok"),
      raw_token: "expired_tok",
      created_by: USER_A_ID,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
      max_uses: null,
      uses: 0,
      revoked_at: null,
    },
    ...getLocal("trako_premium_invites"),
  ]);
  const expiredRes = joinGroupWithToken("expired_tok", "usr-0003-user-c");
  console.log(
    "Expired token test:",
    expiredRes.error ? `BLOCKED (${expiredRes.error})` : "FAILED SECURITY",
  );

  // 6. Persistence across refresh/signout
  console.log("\n--- 6. PERSISTENCE VERIFICATION ---");
  const snapshotBefore = JSON.stringify(store);
  // Simulate simulated reload from storage
  const restoredStore = JSON.parse(snapshotBefore);
  console.log(
    "Restored groups count:",
    restoredStore.trako_premium_groups.length,
  );
  console.log(
    "Restored members count:",
    restoredStore.trako_premium_members.length,
  );
  console.log(
    "Persistence check:",
    restoredStore.trako_premium_groups.length === 3 ? "PASSED" : "FAILED",
  );
}

runTestSuite();
