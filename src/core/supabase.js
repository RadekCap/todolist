import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.0/+esm'

// Allow test environments to override Supabase connection via window.__APP_CONFIG__
const config = window.__APP_CONFIG__ || {}

const supabaseUrl = config.supabaseUrl || 'https://rkvmujdayjmszmyzbhal.supabase.co'
const supabaseKey = config.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA'

export { supabaseUrl, supabaseKey }
export const supabase = createClient(supabaseUrl, supabaseKey)
