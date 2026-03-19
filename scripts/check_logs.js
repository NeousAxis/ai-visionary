const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    const { data: logs } = await supabase
        .from('system_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);

    (logs || []).forEach(d => {
        console.log(`[${d.level}] ${d.step}: ${d.message} | ${JSON.stringify(d.data || {}).substring(0, 200)}`);
    });
    process.exit(0);
})();
