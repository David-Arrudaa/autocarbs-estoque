const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// Rate limiting para proteção contra força bruta no Login (máximo 10 tentativas por 5 minutos)
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Muitas tentativas incorretas. Por segurança, aguarde 5 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting para exclusão com senha de supervisor
const supervisorLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Muitas tentativas de autorização. Aguarde 5 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting para rotas gerais autenticadas (100 req/minuto por IP)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: {
        success: false,
        error: 'Muitas requisições. Aguarde um momento e tente novamente.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health'
});

/**
 * Cria um token de sessão assinado com validade de 12 horas,
 * embutindo os dados do usuário para controle RBAC.
 *
 * @param {Object} [usuario]
 * @param {string} [usuario.id]
 * @param {string} [usuario.nome]
 * @param {'operador'|'supervisor'|'admin'} [usuario.role]
 */
function gerarTokenSessao(usuario = {}) {
    const payload = {
        id: usuario.id || null,
        nome: usuario.nome || 'Operador Padrão',
        role: usuario.role || 'operador',
        exp: Date.now() + (12 * 60 * 60 * 1000), // 12h
        rnd: crypto.randomBytes(8).toString('hex')
    };
    const str = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('hex');
    return `${str}.${signature}`;
}

/**
 * Valida o token de sessão enviado no cabeçalho Authorization
 */
function validarTokenSessao(token) {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [str, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(str).digest('hex');

    // Comparação segura contra timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return false;
    }

    try {
        const payload = JSON.parse(Buffer.from(str, 'base64').toString('utf8'));
        if (payload.exp < Date.now()) {
            return false; // Expirado
        }
        return payload;
    } catch {
        return false;
    }
}

/**
 * Middleware para proteger rotas da API.
 * Aceita token via cookie HttpOnly (prioridade) ou Bearer header (compatibilidade).
 */
function autenticarRequisicao(req, res, next) {
    // Cookie HttpOnly é a forma segura — enviado automaticamente pelo browser
    const cookieToken = req.cookies?.autocar_session;

    // Bearer header como fallback (para clients que ainda usam localStorage)
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.headers['x-auth-token'];

    const token = cookieToken || bearerToken;

    const sessaoValida = validarTokenSessao(token);
    if (!sessaoValida) {
        return res.status(401).json({
            success: false,
            error: 'Sessão expirada ou não autorizada. Faça login novamente.'
        });
    }

    req.user = sessaoValida;
    next();
}

/**
 * Middleware de autorização RBAC (Role-Based Access Control).
 * Permite definir quais papéis podem acessar determinada rota.
 *
 * Exemplo de uso:
 * router.delete('/:id', autenticarRequisicao, exigirRole('supervisor', 'admin'), ...)
 *
 * @param {...string} rolesPermitidas - Ex: 'supervisor', 'admin'
 */
function exigirRole(...rolesPermitidas) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
        }

        const userRole = req.user.role || 'operador';

        // Administrador tem passe livre em qualquer rota protegida
        if (userRole === 'admin' || rolesPermitidas.includes(userRole)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: `Acesso negado. Esta operação requer perfil: ${rolesPermitidas.join(' ou ')}.`
        });
    };
}

module.exports = {
    loginLimiter,
    supervisorLimiter,
    apiLimiter,
    gerarTokenSessao,
    validarTokenSessao,
    autenticarRequisicao,
    exigirRole,
    verificarToken: autenticarRequisicao
};
