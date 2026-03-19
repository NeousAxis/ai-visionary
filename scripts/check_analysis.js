const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // 1. Check webhook_debug logs for latest webhook
  const { data: logs } = await supabase
    .from('webhook_debug')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10);

  console.log('=== WEBHOOK LOGS (last 10) ===');
  (logs || []).forEach(d => {
    console.log(d.id, '|', d.step, '|', (d.message || '').substring(0, 150));
  });

  // 2. Check analyses collection for eclore (www)
  console.log('\n=== ANALYSES WITH eclore (www) ===');
  const { data: all } = await supabase
    .from('analyses')
    .select('*')
    .ilike('url', 'https://www.eclore%')
    .limit(10);

  (all || []).forEach(d => {
    const hasFields = d.data && d.data.fields && Object.keys(d.data.fields).length > 0;
    console.log(d.id, '| score:', d.score, '| email:', d.email, '| hasFields:', hasFields, '| keys:', Object.keys(d).join(','));
  });

  // 3. Also check without www
  console.log('\n=== ANALYSES WITH eclore (no www) ===');
  const { data: all2 } = await supabase
    .from('analyses')
    .select('*')
    .ilike('url', 'https://eclore%')
    .limit(10);

  (all2 || []).forEach(d => {
    const hasFields = d.data && d.data.fields && Object.keys(d.data.fields).length > 0;
    console.log(d.id, '| score:', d.score, '| email:', d.email, '| hasFields:', hasFields, '| keys:', Object.keys(d).join(','));
  });

  // 4. Check ALL analyses docs (latest 5)
  console.log('\n=== LATEST 5 ANALYSES ===');
  const { data: latest } = await supabase
    .from('analyses')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5);

  (latest || []).forEach(d => {
    const hasFields = d.data && d.data.fields && Object.keys(d.data.fields).length > 0;
    console.log(d.id, '| score:', d.score, '| url:', d.url, '| email:', d.email, '| hasFields:', hasFields);
  });

  process.exit(0);
})();
