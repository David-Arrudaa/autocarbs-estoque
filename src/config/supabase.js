const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
        persistSession: false
    }
});

module.exports = supabase;

