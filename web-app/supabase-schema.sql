-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.students (
    usercode text PRIMARY KEY,
    name text,
    nameeng text,
    email text,
    profile_image_url text,
    is_custom_image integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create policies (Optional: adjust based on your security needs)
CREATE POLICY "Public profiles are viewable by everyone."
    ON public.students FOR SELECT
    USING ( true );

CREATE POLICY "Service role can insert/update."
    ON public.students FOR ALL
    USING ( true )
    WITH CHECK ( true );

-- =====================================================================================
-- Table: evaluation_submissions
-- Description: Tracks which evaluations a student has successfully submitted.
-- Used to cache the "completed" state until the university API actually updates its status.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.evaluation_submissions (
    id SERIAL PRIMARY KEY,
    user_code text NOT NULL,
    evaluate_id text NOT NULL,
    officer_id text NOT NULL,
    class_id text NOT NULL,
    submitted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Compound index to ensure uniqueness per student per teacher per evaluation form
CREATE UNIQUE INDEX IF NOT EXISTS evaluation_submissions_unique_idx
ON public.evaluation_submissions (user_code, evaluate_id, officer_id, class_id);

ALTER TABLE public.evaluation_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to evaluations" ON public.evaluation_submissions
    FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to evaluations" ON public.evaluation_submissions
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================================
-- Agent memory foundation: graph snapshots, relation edges, semantic memory, impact logs
-- =====================================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.set_agent_memory_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.graph_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_name TEXT NOT NULL,
    branch_name TEXT,
    commit_sha TEXT NOT NULL,
    graph_version TEXT NOT NULL DEFAULT '1',
    source_scope JSONB DEFAULT '[]'::jsonb NOT NULL,
    graph_json_path TEXT,
    report_path TEXT,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'failed')),
    graph_stats JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (repo_name, commit_sha)
);

DROP TRIGGER IF EXISTS set_graph_snapshots_updated_at ON public.graph_snapshots;
CREATE TRIGGER set_graph_snapshots_updated_at
BEFORE UPDATE ON public.graph_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE TABLE IF NOT EXISTS public.graph_nodes (
    node_ref TEXT PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES public.graph_snapshots(id) ON DELETE CASCADE,
    node_key TEXT NOT NULL,
    label TEXT NOT NULL,
    node_type TEXT NOT NULL,
    file_type TEXT,
    source_file TEXT,
    source_location TEXT,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (snapshot_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_snapshot ON public.graph_nodes (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON public.graph_nodes (node_type);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_source_file ON public.graph_nodes (source_file);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_label_trgm ON public.graph_nodes USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_source_file_trgm ON public.graph_nodes USING gin (source_file gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES public.graph_snapshots(id) ON DELETE CASCADE,
    source_node_ref TEXT NOT NULL REFERENCES public.graph_nodes(node_ref) ON DELETE CASCADE,
    target_node_ref TEXT NOT NULL REFERENCES public.graph_nodes(node_ref) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('EXTRACTED', 'INFERRED', 'AMBIGUOUS')),
    confidence_score REAL NOT NULL DEFAULT 1.0,
    source_file TEXT,
    weight REAL NOT NULL DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS graph_edges_unique_idx
    ON public.graph_edges (snapshot_id, source_node_ref, target_node_ref, relation, COALESCE(source_file, ''));
CREATE INDEX IF NOT EXISTS idx_graph_edges_snapshot ON public.graph_edges (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source_ref ON public.graph_edges (source_node_ref);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target_ref ON public.graph_edges (target_node_ref);
CREATE INDEX IF NOT EXISTS idx_graph_edges_relation ON public.graph_edges (relation);

CREATE TABLE IF NOT EXISTS public.graph_hyperedges (
    id TEXT PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES public.graph_snapshots(id) ON DELETE CASCADE,
    hyperedge_key TEXT NOT NULL,
    label TEXT NOT NULL,
    relation TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('EXTRACTED', 'INFERRED', 'AMBIGUOUS')),
    confidence_score REAL NOT NULL DEFAULT 1.0,
    source_file TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (snapshot_id, hyperedge_key)
);

CREATE TABLE IF NOT EXISTS public.graph_hyperedge_nodes (
    hyperedge_id TEXT NOT NULL REFERENCES public.graph_hyperedges(id) ON DELETE CASCADE,
    node_ref TEXT NOT NULL REFERENCES public.graph_nodes(node_ref) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (hyperedge_id, node_ref)
);

CREATE INDEX IF NOT EXISTS idx_graph_hyperedge_nodes_node_ref ON public.graph_hyperedge_nodes (node_ref);

CREATE TABLE IF NOT EXISTS public.memory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_name TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('repo', 'subsystem', 'node', 'fix', 'incident', 'release')),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_snapshot_id UUID REFERENCES public.graph_snapshots(id) ON DELETE SET NULL,
    source_node_refs TEXT[] DEFAULT '{}'::text[] NOT NULL,
    provenance JSONB DEFAULT '{}'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ,
    UNIQUE (repo_name, memory_key)
);

DROP TRIGGER IF EXISTS set_memory_items_updated_at ON public.memory_items;
CREATE TRIGGER set_memory_items_updated_at
BEFORE UPDATE ON public.memory_items
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_memory_items_repo_created_at ON public.memory_items (repo_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_items_scope_kind ON public.memory_items (scope, kind);
CREATE INDEX IF NOT EXISTS idx_memory_items_snapshot ON public.memory_items (source_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_source_node_refs ON public.memory_items USING gin (source_node_refs);
CREATE INDEX IF NOT EXISTS idx_memory_items_title_trgm ON public.memory_items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_memory_items_content_trgm ON public.memory_items USING gin (content gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.memory_embeddings (
    memory_item_id UUID PRIMARY KEY REFERENCES public.memory_items(id) ON DELETE CASCADE,
    embedding_model TEXT NOT NULL DEFAULT 'Supabase/gte-small',
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.impact_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_name TEXT NOT NULL,
    snapshot_id UUID REFERENCES public.graph_snapshots(id) ON DELETE SET NULL,
    trigger_type TEXT NOT NULL,
    trigger_value TEXT NOT NULL,
    direct_impact JSONB DEFAULT '[]'::jsonb NOT NULL,
    transitive_impact JSONB DEFAULT '[]'::jsonb NOT NULL,
    historical_risk JSONB DEFAULT '[]'::jsonb NOT NULL,
    related_memories JSONB DEFAULT '[]'::jsonb NOT NULL,
    recommended_tests JSONB DEFAULT '[]'::jsonb NOT NULL,
    risk_score REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_impact_assessments_repo_created_at ON public.impact_assessments (repo_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_assessments_snapshot ON public.impact_assessments (snapshot_id);

CREATE TABLE IF NOT EXISTS public.fix_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES public.impact_assessments(id) ON DELETE SET NULL,
    repo_name TEXT NOT NULL,
    commit_sha TEXT,
    changed_files JSONB DEFAULT '[]'::jsonb NOT NULL,
    tests_run JSONB DEFAULT '[]'::jsonb NOT NULL,
    failures_found JSONB DEFAULT '[]'::jsonb NOT NULL,
    final_resolution TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fix_outcomes_repo_created_at ON public.fix_outcomes (repo_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fix_outcomes_assessment ON public.fix_outcomes (assessment_id);

CREATE TABLE IF NOT EXISTS public.agent_memory_jobs (
    job_name TEXT PRIMARY KEY,
    repo_name TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'success', 'failed')),
    lock_id TEXT,
    pid INTEGER,
    hostname TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    result JSONB DEFAULT '{}'::jsonb NOT NULL,
    error JSONB DEFAULT '{}'::jsonb NOT NULL,
    stale_after_ms BIGINT NOT NULL DEFAULT 7200000,
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_agent_memory_jobs_updated_at ON public.agent_memory_jobs;
CREATE TRIGGER set_agent_memory_jobs_updated_at
BEFORE UPDATE ON public.agent_memory_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_agent_memory_jobs_state ON public.agent_memory_jobs (state);
CREATE INDEX IF NOT EXISTS idx_agent_memory_jobs_repo_updated_at ON public.agent_memory_jobs (repo_name, updated_at DESC);

-- =====================================================================================
-- Google Classroom notification mirror: OAuth connection and per-user notification feed
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.google_classroom_connections (
    user_code TEXT PRIMARY KEY,
    google_user_id TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    picture_url TEXT,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    scope TEXT NOT NULL DEFAULT '',
    access_token_expires_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    last_sync_started_at TIMESTAMPTZ,
    last_sync_error TEXT,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_google_classroom_connections_updated_at ON public.google_classroom_connections;
CREATE TRIGGER set_google_classroom_connections_updated_at
BEFORE UPDATE ON public.google_classroom_connections
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_google_classroom_connections_google_user ON public.google_classroom_connections (google_user_id);
CREATE INDEX IF NOT EXISTS idx_google_classroom_connections_revoked ON public.google_classroom_connections (revoked_at);

CREATE TABLE IF NOT EXISTS public.google_classroom_notifications (
    notification_id TEXT PRIMARY KEY,
    user_code TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('announcement', 'courseWork', 'studentSubmission')),
    event_type TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_name TEXT,
    announcement_id TEXT,
    course_work_id TEXT,
    student_submission_id TEXT,
    href TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    sort_at TIMESTAMPTZ NOT NULL,
    resource_updated_at TIMESTAMPTZ NOT NULL,
    seen_at TIMESTAMPTZ,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_google_classroom_notifications_updated_at ON public.google_classroom_notifications;
CREATE TRIGGER set_google_classroom_notifications_updated_at
BEFORE UPDATE ON public.google_classroom_notifications
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_google_classroom_notifications_user_sort ON public.google_classroom_notifications (user_code, sort_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_classroom_notifications_user_seen ON public.google_classroom_notifications (user_code, seen_at, sort_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_classroom_notifications_course_work ON public.google_classroom_notifications (course_id, course_work_id);

CREATE TABLE IF NOT EXISTS public.google_classroom_registrations (
    registration_id TEXT PRIMARY KEY,
    user_code TEXT NOT NULL,
    course_id TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    feed_type TEXT NOT NULL DEFAULT 'COURSE_WORK_CHANGES',
    expiry_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (user_code, course_id)
);

DROP TRIGGER IF EXISTS set_google_classroom_registrations_updated_at ON public.google_classroom_registrations;
CREATE TRIGGER set_google_classroom_registrations_updated_at
BEFORE UPDATE ON public.google_classroom_registrations
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_google_classroom_registrations_user_course ON public.google_classroom_registrations (user_code, course_id);
CREATE INDEX IF NOT EXISTS idx_google_classroom_registrations_expiry ON public.google_classroom_registrations (expiry_time);

CREATE TABLE IF NOT EXISTS public.google_mail_connections (
    user_code TEXT PRIMARY KEY,
    google_user_id TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    picture_url TEXT,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    scope TEXT NOT NULL DEFAULT '',
    access_token_expires_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    last_sync_error TEXT,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_google_mail_connections_updated_at ON public.google_mail_connections;
CREATE TRIGGER set_google_mail_connections_updated_at
BEFORE UPDATE ON public.google_mail_connections
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_google_mail_connections_google_user ON public.google_mail_connections (google_user_id);
CREATE INDEX IF NOT EXISTS idx_google_mail_connections_revoked ON public.google_mail_connections (revoked_at);

CREATE TABLE IF NOT EXISTS public.gmail_sync_cursors (
    user_code TEXT PRIMARY KEY,
    last_message_internal_date TEXT,
    last_history_id TEXT,
    last_query_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_gmail_sync_cursors_updated_at ON public.gmail_sync_cursors;
CREATE TRIGGER set_gmail_sync_cursors_updated_at
BEFORE UPDATE ON public.gmail_sync_cursors
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE TABLE IF NOT EXISTS public.gmail_classroom_notifications (
    notification_id TEXT PRIMARY KEY,
    user_code TEXT NOT NULL,
    gmail_message_id TEXT NOT NULL,
    gmail_thread_id TEXT,
    sender TEXT,
    subject TEXT,
    snippet TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('announcement', 'courseWork', 'returnedWork', 'general')),
    course_hint TEXT,
    href TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    sort_at TIMESTAMPTZ NOT NULL,
    resource_updated_at TIMESTAMPTZ NOT NULL,
    seen_at TIMESTAMPTZ,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_gmail_classroom_notifications_updated_at ON public.gmail_classroom_notifications;
CREATE TRIGGER set_gmail_classroom_notifications_updated_at
BEFORE UPDATE ON public.gmail_classroom_notifications
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_classroom_notifications_user_message ON public.gmail_classroom_notifications (user_code, gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_gmail_classroom_notifications_user_sort ON public.gmail_classroom_notifications (user_code, sort_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_classroom_notifications_user_seen ON public.gmail_classroom_notifications (user_code, seen_at, sort_at DESC);

ALTER TABLE public.graph_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_hyperedges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_classroom_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_mail_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.graph_hyperedge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fix_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_classroom_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_classroom_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_classroom_notifications ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Service role full access to graph_snapshots" ON public.graph_snapshots;
CREATE POLICY "Service role full access to graph_snapshots"
    ON public.graph_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to graph_nodes" ON public.graph_nodes;
CREATE POLICY "Service role full access to graph_nodes"
    ON public.graph_nodes FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to graph_edges" ON public.graph_edges;
CREATE POLICY "Service role full access to graph_edges"
    ON public.graph_edges FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to graph_hyperedges" ON public.graph_hyperedges;
CREATE POLICY "Service role full access to graph_hyperedges"
    ON public.graph_hyperedges FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to graph_hyperedge_nodes" ON public.graph_hyperedge_nodes;
CREATE POLICY "Service role full access to graph_hyperedge_nodes"
    ON public.graph_hyperedge_nodes FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to memory_items" ON public.memory_items;
CREATE POLICY "Service role full access to memory_items"
    ON public.memory_items FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to memory_embeddings" ON public.memory_embeddings;
CREATE POLICY "Service role full access to memory_embeddings"
    ON public.memory_embeddings FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to impact_assessments" ON public.impact_assessments;
CREATE POLICY "Service role full access to impact_assessments"
    ON public.impact_assessments FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to fix_outcomes" ON public.fix_outcomes;
CREATE POLICY "Service role full access to fix_outcomes"
    ON public.fix_outcomes FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to agent_memory_jobs" ON public.agent_memory_jobs;
CREATE POLICY "Service role full access to agent_memory_jobs"
    ON public.agent_memory_jobs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to google_classroom_connections" ON public.google_classroom_connections;
CREATE POLICY "Service role full access to google_classroom_connections"
    ON public.google_classroom_connections FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to google_classroom_registrations" ON public.google_classroom_registrations;
CREATE POLICY "Service role full access to google_classroom_registrations"
    ON public.google_classroom_registrations FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to google_classroom_notifications" ON public.google_classroom_notifications;
CREATE POLICY "Service role full access to google_classroom_notifications"
    ON public.google_classroom_notifications FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to google_mail_connections" ON public.google_mail_connections;
CREATE POLICY "Service role full access to google_mail_connections"
    ON public.google_mail_connections FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to gmail_sync_cursors" ON public.gmail_sync_cursors;
CREATE POLICY "Service role full access to gmail_sync_cursors"
    ON public.gmail_sync_cursors FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to gmail_classroom_notifications" ON public.gmail_classroom_notifications;
CREATE POLICY "Service role full access to gmail_classroom_notifications"
    ON public.gmail_classroom_notifications FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =====================================================================================
-- Student loan central event registry and per-user notification materialization
-- =====================================================================================

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

-- =====================================================================================
-- LINE Messaging webhook ingress: linked LINE accounts, pending link requests, audit log
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.line_messaging_accounts (
    line_user_id TEXT PRIMARY KEY,
    user_code TEXT,
    display_name TEXT,
    picture_url TEXT,
    language TEXT,
    status_message TEXT,
    friendship_status TEXT NOT NULL DEFAULT 'following' CHECK (friendship_status IN ('following', 'unfollowed')),
    link_status TEXT NOT NULL DEFAULT 'unlinked' CHECK (link_status IN ('linked', 'unlinked')),
    last_followed_at TIMESTAMPTZ,
    last_unfollowed_at TIMESTAMPTZ,
    last_linked_at TIMESTAMPTZ,
    last_unlinked_at TIMESTAMPTZ,
    last_webhook_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_line_messaging_accounts_updated_at ON public.line_messaging_accounts;
CREATE TRIGGER set_line_messaging_accounts_updated_at
BEFORE UPDATE ON public.line_messaging_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_messaging_accounts_linked_user_code
    ON public.line_messaging_accounts (user_code)
    WHERE user_code IS NOT NULL AND link_status = 'linked';
CREATE INDEX IF NOT EXISTS idx_line_messaging_accounts_friendship
    ON public.line_messaging_accounts (friendship_status, last_webhook_at DESC);

CREATE TABLE IF NOT EXISTS public.line_link_requests (
    nonce TEXT PRIMARY KEY,
    user_code TEXT NOT NULL,
    line_user_id TEXT,
    pairing_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'failed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    linked_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_line_link_requests_updated_at ON public.line_link_requests;
CREATE TRIGGER set_line_link_requests_updated_at
BEFORE UPDATE ON public.line_link_requests
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_line_link_requests_user_status
    ON public.line_link_requests (user_code, status, expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_line_link_requests_pairing_code
    ON public.line_link_requests (pairing_code);

CREATE TABLE IF NOT EXISTS public.line_webhook_events (
    webhook_event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    mode TEXT,
    line_user_id TEXT,
    group_id TEXT,
    room_id TEXT,
    is_redelivery BOOLEAN NOT NULL DEFAULT FALSE,
    occurred_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'ignored', 'failed')),
    error_message TEXT,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS set_line_webhook_events_updated_at ON public.line_webhook_events;
CREATE TRIGGER set_line_webhook_events_updated_at
BEFORE UPDATE ON public.line_webhook_events
FOR EACH ROW EXECUTE FUNCTION public.set_agent_memory_updated_at();

CREATE INDEX IF NOT EXISTS idx_line_webhook_events_status_processed_at
    ON public.line_webhook_events (status, processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_webhook_events_line_user
    ON public.line_webhook_events (line_user_id, occurred_at DESC);

ALTER TABLE public.line_messaging_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to line_messaging_accounts" ON public.line_messaging_accounts;
CREATE POLICY "Service role full access to line_messaging_accounts"
    ON public.line_messaging_accounts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to line_link_requests" ON public.line_link_requests;
CREATE POLICY "Service role full access to line_link_requests"
    ON public.line_link_requests FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to line_webhook_events" ON public.line_webhook_events;
CREATE POLICY "Service role full access to line_webhook_events"
    ON public.line_webhook_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
