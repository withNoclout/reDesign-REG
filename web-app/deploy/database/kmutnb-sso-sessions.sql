CREATE TABLE IF NOT EXISTS public.kmutnb_sso_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'kmutnb_sso',
    sso_subject TEXT NOT NULL,
    user_code TEXT,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    id_token_encrypted TEXT,
    scope TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    access_token_expires_at TIMESTAMPTZ,
    user_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_refreshed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kmutnb_sso_sessions_subject
    ON public.kmutnb_sso_sessions (sso_subject);

CREATE INDEX IF NOT EXISTS idx_kmutnb_sso_sessions_user_code
    ON public.kmutnb_sso_sessions (user_code);

CREATE INDEX IF NOT EXISTS idx_kmutnb_sso_sessions_active
    ON public.kmutnb_sso_sessions (revoked_at, access_token_expires_at);
