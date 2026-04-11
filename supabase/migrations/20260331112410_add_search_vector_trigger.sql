
-- Create function to auto-populate search_vector on insert/update
CREATE OR REPLACE FUNCTION legal_chunks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'simple',
    coalesce(NEW.article_number, '') || ' ' ||
    coalesce(NEW.article_title, '') || ' ' ||
    coalesce(NEW.content, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_legal_chunks_search_vector
  BEFORE INSERT OR UPDATE OF content, article_number, article_title
  ON legal_chunks
  FOR EACH ROW
  EXECUTE FUNCTION legal_chunks_search_vector_update();
;
