import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const isCloudReady = Boolean(url && key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_'))
export const supabase = isCloudReady ? createClient(url, key) : null
export const BUCKET = 'wedding-assets'
