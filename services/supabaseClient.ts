import { createClient } from '@supabase/supabase-js';

// В этой среде .env может не подгружаться автоматически для кастомных переменных.
// Для стабильности используем ключи напрямую.
const SUPABASE_URL = 'https://zmpdmtopclevptgcjwgj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcGRtdG9wY2xldnB0Z2Nqd2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NjAzMTUsImV4cCI6MjA4NDEzNjMxNX0.Pe2QSzLS6ILHzjgjbcywqvaTqjUgpJQDmBFKCyZ3QKU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);