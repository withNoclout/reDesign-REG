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
