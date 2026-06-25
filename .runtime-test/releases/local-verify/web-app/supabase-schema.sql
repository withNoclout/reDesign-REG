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

ALTER TABLE public.graph_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_hyperedges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_hyperedge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fix_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory_jobs ENABLE ROW LEVEL SECURITY;

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
