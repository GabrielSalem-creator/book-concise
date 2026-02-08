-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-summaries', 'audio-summaries', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for audio bucket
CREATE POLICY "Audio files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio-summaries');

CREATE POLICY "Service role can upload audio files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'audio-summaries');

-- Add audio_url column to summaries if not exists (already exists, but ensure it's there)
-- Add audio generation tracking
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS audio_voice TEXT DEFAULT 'en-US-AvaNeural';