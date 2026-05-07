-- Add canonical_pdf_path column to resumes.
-- Stores a server-converted PDF path for DOCX uploads so the frontend's
-- PDF.js renderer always has a real PDF to render. PDF uploads leave this
-- null and the frontend uses storage_path directly.

ALTER TABLE resumes
  ADD COLUMN canonical_pdf_path text;
