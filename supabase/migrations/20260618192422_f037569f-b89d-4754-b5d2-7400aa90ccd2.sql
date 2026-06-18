
CREATE TABLE public.book_documentaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  scenes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id)
);

GRANT SELECT ON public.book_documentaries TO anon, authenticated;
GRANT ALL ON public.book_documentaries TO service_role;

ALTER TABLE public.book_documentaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read documentaries"
  ON public.book_documentaries
  FOR SELECT
  USING (true);

CREATE POLICY "Service role manages documentaries"
  ON public.book_documentaries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_book_documentaries_updated_at
  BEFORE UPDATE ON public.book_documentaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
