-- Migration: Add extraction_status and page_count columns to documents table
-- Run this in Supabase SQL Editor

-- Add extraction_status column with default 'pending'
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) DEFAULT 'pending'
CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add page_count column (nullable, set after extraction)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS page_count INTEGER;

-- Update existing documents (if any) to have 'completed' status
-- This assumes any existing documents were already processed
UPDATE documents 
SET extraction_status = 'completed' 
WHERE extraction_status IS NULL;

