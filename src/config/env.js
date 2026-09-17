require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Validação de variáveis obrigatórias — o servidor NÃO sobe se faltar alguma.
// Isso evita rodar com segredos padrão/hardcoded em produção.
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_VARS = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'PIN_ACESSO',
    'PIN_SUPERVISOR',
    'SESSION_SECRET'
];

const missing = REQUIRED_VARS.filter(v => !process.env[v] || !process.env[v].trim());

if (missing.length > 0) {
    console.error('\n🚨 ERRO CRÍTICO: Variáveis de ambiente obrigatórias não configuradas:');
    missing.forEach(v => console.error(`   ✗ ${v}`));
    console.error('\n   Configure o arquivo .env baseado no .env.example e reinicie o servidor.\n');
    process.exit(1);
}

const config = {
    port:          parseInt(process.env.PORT) || 3000,
    nodeEnv:       process.env.NODE_ENV || 'production',
    supabaseUrl:   process.env.SUPABASE_URL,
    supabaseKey:   process.env.SUPABASE_KEY,
    pinAcesso:     process.env.PIN_ACESSO,
    pinSupervisor: process.env.PIN_SUPERVISOR,
    sessionSecret: process.env.SESSION_SECRET,
    // Lista de origens permitidas para CORS (separar múltiplas por vírgula no .env)
    allowedOrigins: (process.env.ALLOWED_ORIGINS || `http://localhost:${process.env.PORT || 3000}`).split(',').map(o => o.trim())
};

module.exports = config;
