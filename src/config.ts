/**
 * Deployment settings, read at build time. All three are public values by
 * design: they identify the project, they do not grant access to data.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const accountsConfigured = SUPABASE_URL !== '' && SUPABASE_KEY !== '';
export const googleConfigured = GOOGLE_WEB_CLIENT_ID !== '';
