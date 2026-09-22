const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const cookieParser = require('cookie-parser');
const config     = require('./src/config/env');
const errorHandler = require('./src/middlewares/errorHandler');

// Rotas modulares do ERP
const authRoutes     = require('./src/modules/auth/auth.routes');
const estoqueRoutes  = require('./src/modules/estoque/estoque.routes');
const cotacoesRoutes = require('./src/modules/cotacoes/cotacoes.routes');
const usuariosRoutes = require('./src/modules/usuarios/usuarios.routes');

const app = express();

// ─── 0. Trust Proxy — OBRIGATÓRIO para rate limiting funcionar no Vercel/Nginx ─
// Sem isso, req.ip aponta para o IP do proxy, tornando o rate limit ineficaz.
app.set('trust proxy', 1);

// ─── 0. Logger de Requisições HTTP (Morgan) ──────────────────────────────────
app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]'));

// ─── 1. Segurança: Helmet (CSP + 14 headers de segurança) ─────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:    ["'self'"],
            scriptSrc:     ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc:      ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            fontSrc:       ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net", "data:"],
            imgSrc:        ["'self'", "data:", "blob:"],
            connectSrc:    ["'self'", "https://*.supabase.co", "https://*.vercel.app"],
            frameSrc:      ["'none'"],
            objectSrc:     ["'none'"]
        }
    },
    crossOriginOpenerPolicy:   { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' }
}));

// ─── 2. CORS: origens explícitas em vez de wildcard ───────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origin (navegação direta, mesmo domínio ou Postman)
        if (!origin) return callback(null, true);
        if (config.allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('localhost')) {
            return callback(null, true);
        }
        return callback(new Error(`Origem não autorizada: ${origin}`));
    },
    methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// ─── 3. Parsers com limites ────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser()); // Necessário para req.cookies funcionar no middleware de auth

// ─── 4. Arquivos estáticos do Frontend ───────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── 5. Módulos da API (Arquitetura ERP Modular) ──────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/estoque',  estoqueRoutes);
app.use('/api/cotacoes', cotacoesRoutes);
app.use('/api/usuarios', usuariosRoutes);

// ─── 6. Health check — protegido, retorna apenas status ──────────────────────
// Não expõe módulos internos; usa require do middleware auth para proteger
const { verificarToken } = require('./src/middlewares/auth');
app.get('/api/health', verificarToken, (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

// ─── 7. Fallback SPA ─────────────────────────────────────────────────────────
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── 8. Handler global de erros ───────────────────────────────────────────────
app.use(errorHandler);

// ─── 9. Inicialização e Exportação (Compatível com Local & Vercel Serverless) ─
if (require.main === module) {
    const server = app.listen(config.port, () => {
        console.log(`=============================================`);
        console.log(`🚀 AutoCar BS ERP - Oficina & Estoque`);
        console.log(`📡 Servidor: http://localhost:${config.port}`);
        console.log(`🌍 Ambiente: ${config.nodeEnv}`);
        console.log(`🔒 Origens permitidas: ${config.allowedOrigins.join(', ')}`);
        console.log(`🛡️  Segurança: Helmet + CORS restrito + Body limit 50kb`);
        console.log(`=============================================`);
    });

    process.on('SIGTERM', () => {
        console.log('SIGTERM recebido — encerrando servidor com graceful shutdown...');
        server.close(() => {
            console.log('Servidor encerrado.');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('\nSIGINT recebido — encerrando servidor...');
        server.close(() => process.exit(0));
    });
}

module.exports = app;
