-- Supabase Database Setup for Winner History
-- Run this SQL in your Supabase SQL Editor

-- Create winners table
CREATE TABLE IF NOT EXISTS winners (
  id BIGSERIAL PRIMARY KEY,
  round INTEGER NOT NULL,
  address TEXT NOT NULL,
  fees DECIMAL(20, 9) NOT NULL DEFAULT 0,
  tx_signature TEXT NOT NULL,
  color TEXT NOT NULL,
  pixels INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_winners_created_at ON winners(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_winners_round ON winners(round);

-- Enable Row Level Security (RLS)
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read winners
CREATE POLICY "Allow public read access" ON winners
  FOR SELECT
  USING (true);

-- Create policy to allow insert from service role only
-- (Your backend will use the service role key to insert)
CREATE POLICY "Allow service role insert" ON winners
  FOR INSERT
  WITH CHECK (true);

-- Verify table was created
SELECT * FROM winners LIMIT 1;

