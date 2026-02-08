-- Add public SELECT policy for audio-summaries bucket to allow browser access
CREATE POLICY "Anyone can read audio files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'audio-summaries');

-- Ensure the bucket is properly configured as public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'audio-summaries';