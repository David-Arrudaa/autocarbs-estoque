const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

// Cliente Supabase principal (Estoque, Peças, Cotações, Usuários)
const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
        persistSession: false
    }
});

// Cliente Supabase dedicado a Clientes, Veículos e Histórico de Checklists/OS
const supabaseClientes = createClient(config.supabaseClientesUrl, config.supabaseClientesKey, {
    auth: {
        persistSession: false
    }
});

// Mantém compatibilidade total com require('./supabase') retornando o cliente padrão
module.exports = supabase;
module.exports.supabase = supabase;
module.exports.supabaseClientes = supabaseClientes;

