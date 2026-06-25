BEGIN;

CREATE TABLE IF NOT EXISTS public.student_loan_source_snapshots (
    id BIGSERIAL PRIMARY KEY,
    source_key TEXT NOT NULL,
    source_url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    parsed_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (source_key, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_student_loan_source_snapshots_key_fetched
    ON public.student_loan_source_snapshots (source_key, fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.student_loan_events (
    event_id TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    audience TEXT NOT NULL CHECK (audience IN ('new', 'continuing')),
    education_level TEXT NOT NULL CHECK (education_level IN ('vocational', 'bachelor')),
    stage TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('open', 'closingSoon')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    href TEXT NOT NULL,
    opens_at TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    visible_from TIMESTAMPTZ NOT NULL,
    visible_until TIMESTAMPTZ NOT NULL,
    dismiss_strategy TEXT NOT NULL CHECK (dismiss_strategy IN ('click', 'expiry')),
    source_hash TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_student_loan_events_updated_at ON public.student_loan_events;
CREATE TRIGGER set_student_loan_events_updated_at
BEFORE UPDATE ON public.student_loan_events
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_student_loan_events_audience_level
    ON public.student_loan_events (audience, education_level, opens_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_loan_events_source_key
    ON public.student_loan_events (source_key, opens_at DESC);

CREATE TABLE IF NOT EXISTS public.student_loan_profiles (
    user_code TEXT PRIMARY KEY,
    borrower_type TEXT NOT NULL CHECK (borrower_type IN ('new', 'continuing')),
    education_level TEXT NOT NULL CHECK (education_level IN ('vocational', 'bachelor')),
    source TEXT NOT NULL CHECK (source IN ('manual', 'seeded', 'inferred', 'migrated')),
    confirmed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_student_loan_profiles_updated_at ON public.student_loan_profiles;
CREATE TRIGGER set_student_loan_profiles_updated_at
BEFORE UPDATE ON public.student_loan_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE TABLE IF NOT EXISTS public.student_loan_rollout_overrides (
    user_code TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT false NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('live', 'preview')),
    preview_now TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_student_loan_rollout_overrides_updated_at ON public.student_loan_rollout_overrides;
CREATE TRIGGER set_student_loan_rollout_overrides_updated_at
BEFORE UPDATE ON public.student_loan_rollout_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE TABLE IF NOT EXISTS public.student_loan_notification_instances (
    id BIGSERIAL PRIMARY KEY,
    user_code TEXT NOT NULL,
    event_id TEXT NOT NULL REFERENCES public.student_loan_events(event_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'clicked', 'expired', 'hidden')),
    visible_from TIMESTAMPTZ NOT NULL,
    visible_until TIMESTAMPTZ NOT NULL,
    clicked_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_reason TEXT CHECK (resolution_reason IN ('click', 'expiry', 'rollout')),
    preview BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (user_code, event_id)
);

DROP TRIGGER IF EXISTS set_student_loan_notification_instances_updated_at ON public.student_loan_notification_instances;
CREATE TRIGGER set_student_loan_notification_instances_updated_at
BEFORE UPDATE ON public.student_loan_notification_instances
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_student_loan_notification_instances_user_status
    ON public.student_loan_notification_instances (user_code, status, visible_from DESC);
CREATE INDEX IF NOT EXISTS idx_student_loan_notification_instances_event
    ON public.student_loan_notification_instances (event_id, user_code);

ALTER TABLE public.student_loan_source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_loan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_loan_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_loan_rollout_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_loan_notification_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to student_loan_source_snapshots" ON public.student_loan_source_snapshots;
CREATE POLICY "Service role full access to student_loan_source_snapshots"
    ON public.student_loan_source_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to student_loan_events" ON public.student_loan_events;
CREATE POLICY "Service role full access to student_loan_events"
    ON public.student_loan_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to student_loan_profiles" ON public.student_loan_profiles;
CREATE POLICY "Service role full access to student_loan_profiles"
    ON public.student_loan_profiles FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to student_loan_rollout_overrides" ON public.student_loan_rollout_overrides;
CREATE POLICY "Service role full access to student_loan_rollout_overrides"
    ON public.student_loan_rollout_overrides FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to student_loan_notification_instances" ON public.student_loan_notification_instances;
CREATE POLICY "Service role full access to student_loan_notification_instances"
    ON public.student_loan_notification_instances FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMIT;
