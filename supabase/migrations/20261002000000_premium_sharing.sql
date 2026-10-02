-- ========== PREMIUM: FAMILY & COMMUNITY JOURNEY SHARING ==========
-- Migration: Premium sharing tables with strict RLS.
-- No GTFS schema tables are touched.

-- -------------------------------------------------------
-- 1. journey_groups
-- -------------------------------------------------------
CREATE TABLE public.journey_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  owner_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,           -- NULL = no hard expiry
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended'))
);

ALTER TABLE public.journey_groups ENABLE ROW LEVEL SECURITY;

-- Owner can read and manage own groups
CREATE POLICY "group owner full access"
  ON public.journey_groups
  FOR ALL
  TO authenticated
  USING  (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Members can read groups they belong to
CREATE POLICY "group member read"
  ON public.journey_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = id
        AND m.user_id  = auth.uid()
        AND m.status   = 'active'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.journey_groups TO authenticated;
GRANT ALL ON public.journey_groups TO service_role;

-- -------------------------------------------------------
-- 2. group_members
-- -------------------------------------------------------
CREATE TABLE public.group_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.journey_groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'left')),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- A member can read all active members of their groups
CREATE POLICY "members can read group peers"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members m2
      WHERE m2.group_id = group_id
        AND m2.user_id  = auth.uid()
        AND m2.status   = 'active'
    )
  );

-- Owner can insert / update / delete members of their own groups
CREATE POLICY "owner manages members"
  ON public.group_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journey_groups g
      WHERE g.id       = group_id
        AND g.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journey_groups g
      WHERE g.id       = group_id
        AND g.owner_id = auth.uid()
    )
  );

-- A user can insert themselves (join via invite is handled via RPC)
CREATE POLICY "self join insert"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- A member can update their own row (e.g., leave)
CREATE POLICY "self update own membership"
  ON public.group_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

-- -------------------------------------------------------
-- 3. group_invites — secure token-based invitations
-- -------------------------------------------------------
CREATE TABLE public.group_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES public.journey_groups(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,   -- SHA-256 of the raw token (never stored raw)
  created_by   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,            -- NULL = never
  max_uses     integer,                -- NULL = unlimited
  uses         integer NOT NULL DEFAULT 0,
  revoked_at   timestamptz             -- NULL = still valid
);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Only the group owner can create / read / revoke invites
CREATE POLICY "owner manages invites"
  ON public.group_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journey_groups g
      WHERE g.id       = group_id
        AND g.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journey_groups g
      WHERE g.id       = group_id
        AND g.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.group_invites TO authenticated;
GRANT ALL ON public.group_invites TO service_role;

-- -------------------------------------------------------
-- 4. location_shares — per-user sharing sessions in a group
-- -------------------------------------------------------
CREATE TABLE public.location_shares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES public.journey_groups(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,           -- NULL = manual stop only
  stopped_at     timestamptz,           -- set when user/auto stops sharing
  sharing_status text NOT NULL DEFAULT 'active'
                 CHECK (sharing_status IN ('active', 'paused', 'stopped', 'expired')),
  transit_mode   text,                  -- 'bus' | 'metro' | 'walking' | null
  transit_label  text,                  -- e.g. 'Bus 159', 'Metro Line 2'
  current_stop   text,
  next_stop      text,
  eta_minutes    integer,
  UNIQUE (group_id, user_id, started_at)
);

ALTER TABLE public.location_shares ENABLE ROW LEVEL SECURITY;

-- Share owner can read/write their own rows
CREATE POLICY "own share full access"
  ON public.location_shares
  FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Active group members can see active shares (not stopped/expired)
CREATE POLICY "members see active shares"
  ON public.location_shares
  FOR SELECT
  TO authenticated
  USING (
    sharing_status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = group_id
        AND m.user_id  = auth.uid()
        AND m.status   = 'active'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.location_shares TO authenticated;
GRANT ALL ON public.location_shares TO service_role;

-- -------------------------------------------------------
-- 5. location_updates — periodic position pings
-- -------------------------------------------------------
CREATE TABLE public.location_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id    uuid NOT NULL REFERENCES public.location_shares(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL,   -- denormalized for RLS performance
  user_id     uuid NOT NULL,   -- denormalized for RLS performance
  -- Coordinates stored at ~100-metre precision (4 decimal places)
  -- Full precision is kept in DB but UI rounds to 3 dp for display.
  lat         double precision NOT NULL,
  lon         double precision NOT NULL,
  accuracy_m  double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX location_updates_share_recent_idx
  ON public.location_updates (share_id, recorded_at DESC);

ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

-- Only the sharer can insert their own pings
CREATE POLICY "own location insert"
  ON public.location_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.location_shares s
      WHERE s.id             = share_id
        AND s.user_id        = auth.uid()
        AND s.sharing_status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
    )
  );

-- Active group members can read pings from active shares
CREATE POLICY "members read active pings"
  ON public.location_updates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.location_shares s
      WHERE s.id             = share_id
        AND s.sharing_status = 'active'
        AND (s.expires_at IS NULL OR s.expires_at > now())
    )
    AND EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = group_id
        AND m.user_id  = auth.uid()
        AND m.status   = 'active'
    )
  );

-- Own pings always readable (for the sharer themselves)
CREATE POLICY "own pings read"
  ON public.location_updates
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT ON public.location_updates TO authenticated;
GRANT ALL ON public.location_updates TO service_role;

-- -------------------------------------------------------
-- 6. Enable Realtime on sharing tables
-- -------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

-- -------------------------------------------------------
-- 7. Secure RPC: join_group_with_token
--    Validates the invite token without exposing token_hash.
--    Returns: 'joined' | 'already_member' | 'invalid' | 'expired' | 'full'
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_group_with_token(_raw_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hash         text;
  _invite       public.group_invites%ROWTYPE;
  _group        public.journey_groups%ROWTYPE;
  _member_count integer;
BEGIN
  -- Compute SHA-256 of the raw token
  _hash := encode(sha256(_raw_token::bytea), 'hex');

  SELECT * INTO _invite
  FROM public.group_invites
  WHERE token_hash = _hash;

  IF NOT FOUND THEN
    RETURN json_build_object('result', 'invalid');
  END IF;

  IF _invite.revoked_at IS NOT NULL THEN
    RETURN json_build_object('result', 'invalid');
  END IF;

  IF _invite.expires_at IS NOT NULL AND _invite.expires_at < now() THEN
    RETURN json_build_object('result', 'expired');
  END IF;

  IF _invite.max_uses IS NOT NULL AND _invite.uses >= _invite.max_uses THEN
    RETURN json_build_object('result', 'full');
  END IF;

  SELECT * INTO _group FROM public.journey_groups WHERE id = _invite.group_id;
  IF NOT FOUND OR _group.status <> 'active' THEN
    RETURN json_build_object('result', 'invalid');
  END IF;

  -- Check already a member
  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _invite.group_id
      AND user_id  = auth.uid()
      AND status   = 'active'
  ) THEN
    RETURN json_build_object(
      'result',   'already_member',
      'group_id', _invite.group_id,
      'group_name', _group.name
    );
  END IF;

  -- Re-activate if previously left
  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _invite.group_id AND user_id = auth.uid()
  ) THEN
    UPDATE public.group_members
    SET status = 'active', joined_at = now()
    WHERE group_id = _invite.group_id AND user_id = auth.uid();
  ELSE
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (_invite.group_id, auth.uid(), 'member');
  END IF;

  -- Increment usage counter
  UPDATE public.group_invites SET uses = uses + 1 WHERE id = _invite.id;

  RETURN json_build_object(
    'result',     'joined',
    'group_id',   _invite.group_id,
    'group_name', _group.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_with_token(text) TO authenticated;

-- -------------------------------------------------------
-- 8. RPC: expire_stale_shares
--    Called client-side on mount to mark expired rows.
--    Runs as SECURITY DEFINER so it can update any row.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_shares()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.location_shares
  SET sharing_status = 'expired'
  WHERE sharing_status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_shares() TO authenticated;
