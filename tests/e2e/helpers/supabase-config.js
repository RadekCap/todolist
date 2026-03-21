/**
 * Shared Supabase configuration for E2E tests.
 * Reads from environment variables so CI can point to a local Supabase instance.
 */

const PROD_URL = 'https://rkvmujdayjmszmyzbhal.supabase.co'
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA'

export const SUPABASE_URL = process.env.SUPABASE_URL || PROD_URL
export const SUPABASE_KEY = process.env.SUPABASE_KEY || PROD_KEY
