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
