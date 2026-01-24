
import { createClient } from '@supabase/supabase-js';

// Hardcoded for serverless function stability
const SUPABASE_URL = 'https://zmpdmtopclevptgcjwgj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcGRtdG9wY2xldnB0Z2Nqd2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NjAzMTUsImV4cCI6MjA4NDEzNjMxNX0.Pe2QSzLS6ILHzjgjbcywqvaTqjUgpJQDmBFKCyZ3QKU';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- CREDENTIALS CONFIGURATION ---
  let SHOP_ID = '1254700'; 
  let SECRET_KEY = 'live_knC5pIMu9fCBWGABTJOXCGtlrZdpGldHJAMrlT6xcsI'; 
  
  const TEST_SHOP_ID = '1256425';
  const TEST_SECRET_KEY = 'test_iCFbKUwMgGqxOuPZ23LbXv--BPh8oDZEG_UJ2wCLHaw';
  
  const SYSTEM_USER_ID = -100;

  try {
      // 1. Check Maintenance Mode in Supabase
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data } = await supabase
        .from('users')
        .select('last_name')
        .eq('id', SYSTEM_USER_ID)
        .maybeSingle();

      if (data && data.last_name) {
          try {
              const config = JSON.parse(data.last_name);
              if (config.maintenanceMode) {
                  SHOP_ID = TEST_SHOP_ID;
                  SECRET_KEY = TEST_SECRET_KEY;
              }
          } catch (e) {
              // ignore parse errors
          }
      }
  } catch (dbError) {
      console.error("DB Check failed", dbError);
  }
  // --------------------------------

  if (req.method !== 'POST') {
     return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });

    // Node 16+ supports btoa
    const auth = btoa(`${SHOP_ID}:${SECRET_KEY}`);

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        throw new Error(`Yookassa API Error: ${response.status}`);
    }

    const data = await response.json();
    // Return the status (e.g., 'succeeded', 'canceled', 'pending')
    return res.status(200).json({ status: data.status, paid: data.paid });

  } catch (error: any) {
    console.error('Check Payment Error:', error);
    return res.status(500).json({ error: 'Check failed', details: error.message });
  }
}
