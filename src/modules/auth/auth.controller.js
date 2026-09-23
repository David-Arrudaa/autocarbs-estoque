const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../../config/supabase');
const { gerarTokenSessao } = require('../../middlewares/auth');
const auditoriaService = require('../auditoria/auditoria.service');

class AuthController {
    /**
     * Efetua o login via E-mail e Senha.
     * Autentica exclusivamente contra a tabela 'usuarios' do Supabase com bcrypt hash.
     * Não há fallback de credenciais estáticas — se a tabela não existir,
     * o servidor retorna 503 explicitamente para que o admin execute a migração SQL.
     */
    async login(req, res, next) {
        try {
            const { email, senha } = req.body;
            const emailLimpo = email ? String(email).trim().toLowerCase() : '';
            const senhaLimpa = senha ? String(senha) : '';

            if (!emailLimpo) {
                return res.status(400).json({ success: false, error: 'O e-mail de acesso é obrigatório.' });
            }

            if (!senhaLimpa) {
                return res.status(400).json({ success: false, error: 'A senha de acesso é obrigatória.' });
            }

            // Busca usuário ativo pelo e-mail na tabela Supabase
            const { data: usuario, error: errDb } = await supabase
                .from('usuarios')
                .select('id, nome, email, senha_hash, pin_hash, role')
                .eq('email', emailLimpo)
                .eq('ativo', true)
                .maybeSingle();

            if (errDb) {
                // Tabela ainda não criada — instrui o admin a executar a migração
                if (errDb.code === '42P01' || errDb.message?.includes('schema cache')) {
                    return res.status(503).json({
                        success: false,
                        error: 'Sistema em configuração. Execute a migração SQL no Supabase para ativar os logins.'
                    });
                }
                throw errDb;
            }

            let usuarioAutenticado = null;

            if (usuario) {
                const hash = usuario.senha_hash || usuario.pin_hash;
                const match = await bcrypt.compare(senhaLimpa, hash);
                if (match) {
                    usuarioAutenticado = {
                        id: usuario.id,
                        nome: usuario.nome,
                        email: usuario.email,
                        role: usuario.role
                    };
                }
            }

            if (!usuarioAutenticado) {
                return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos!' });
            }

            // Gera token com identidade e role para RBAC
            const token = gerarTokenSessao(usuarioAutenticado);

            // Entrega o token via cookie HttpOnly (mais seguro que localStorage)
            res.cookie('autocar_session', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/',
                maxAge: 12 * 60 * 60 * 1000 // 12 horas
            });

            // Registra login na trilha de auditoria (fire-and-forget intencional)
            auditoriaService.registrar({
                usuario: usuarioAutenticado,
                acao: 'LOGIN',
                tabela: 'usuarios',
                registroId: usuarioAutenticado.id,
                detalhes: { ip: req.ip }
            });

            return res.json({
                success: true,
                usuario: usuarioAutenticado
                // token não é enviado no body — viaja apenas no cookie HttpOnly
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Encerra a sessão limpando o cookie de autenticação
     */
    logout(req, res) {
        res.clearCookie('autocar_session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });
        return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
    }

    /**
     * Verifica a validade do token de sessão ativo e retorna dados do perfil
     */
    verificarSessao(req, res) {
        return res.json({
            success: true,
            ativo: true,
            usuario: req.user
        });
    }
}

module.exports = new AuthController();

