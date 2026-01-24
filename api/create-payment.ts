
import { createClient } from '@supabase/supabase-js';

// Hardcoded for serverless function stability (same as frontend)
const SUPABASE_URL = 'https://zmpdmtopclevptgcjwgj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcGRtdG9wY2xldnB0Z2Nqd2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NjAzMTUsImV4cCI6MjA4NDEzNjMxNX0.Pe2QSzLS6ILHzjgjbcywqvaTqjUgpJQDmBFKCyZ3QKU';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- CREDENTIALS CONFIGURATION ---
  let SHOP_ID = '1254700'; // Default Live
  let SECRET_KEY = 'live_knC5pIMu9fCBWGABTJOXCGtlrZdpGldHJAMrlT6xcsI'; // Default Live
  
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
                  console.log("Maintenance Mode ON: Using Test Credentials");
                  SHOP_ID = TEST_SHOP_ID;
                  SECRET_KEY = TEST_SECRET_KEY;
              }
          } catch (e) {
              console.error("Failed to parse system config", e);
          }
      }
  } catch (dbError) {
      console.error("DB Check failed, defaulting to live", dbError);
  }
  // --------------------------------

  if (req.method !== 'POST') {
     return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { amount, returnUrl, description } = req.body;
    const idempotenceKey = Math.random().toString(36).substring(7);
    
    // Replace Buffer with btoa for TypeScript compatibility without @types/node
    const auth = btoa(`${SHOP_ID}:${SECRET_KEY}`);

    // Используем встроенный fetch (Node 18+)
    const backendRes = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: {
          value: amount || "1.00",
          currency: "RUB"
        },
        capture: true,
        confirmation: {
            type: "redirect",
            return_url: returnUrl
        },
        description: description || "Оплата StyleVision"
      })
    });

    if (!backendRes.ok) {
        const errorText = await backendRes.text();
        console.error('Yookassa Error:', errorText);
        try {
            const jsonErr = JSON.parse(errorText);
            return res.status(backendRes.status).json(jsonErr);
        } catch (e) {
            return res.status(backendRes.status).json({ error: errorText });
        }
    }

    const data = await backendRes.json();
    return res.status(200).json(data);

  } catch (error: any) {
    console.error('API Handler Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
