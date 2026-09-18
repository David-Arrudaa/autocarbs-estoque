const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../../config/supabase');
const config = require('../../config/env');
const { gerarTokenSessao } = require('../../middlewares/auth');
const auditoriaService = require('../auditoria/auditoria.service');

function timingSafeMatch(a, b) {
    const bufA = Buffer.alloc(64);
    const bufB = Buffer.alloc(64);
    Buffer.from(String(a).trim()).copy(bufA);
    Buffer.from(String(b).trim()).copy(bufB);
    return crypto.timingSafeEqual(bufA, bufB);
}

class AuthController {
    /**
     * Efetua o login via E-mail e Senha no servidor.
     * 1. Tenta autenticar na tabela 'usuarios' do Supabase com bcrypt hash.
     * 2. Se a tabela não existir ou o login não for encontrado,
     *    testa contra credenciais mestres configuradas no .env (Fallback Gracioso).
     */
    async login(req, res, next) {
        try {
            const { email, senha, pin } = req.body;
            const emailLimpo = email ? String(email).trim().toLowerCase() : '';
            const senhaLimpa = senha ? String(senha).trim() : (pin ? String(pin).trim() : '');

            if (!senhaLimpa) {
                return res.status(400).json({ success: false, error: 'A senha de acesso é obrigatória.' });
            }

            let usuarioAutenticado = null;

            // 1. Tenta buscar usuário na tabela 'usuarios' do Supabase
            try {
                if (emailLimpo) {
                    const { data: usuario, error: errDb } = await supabase
                        .from('usuarios')
                        .select('id, nome, email, senha_hash, pin_hash, role')
                        .eq('email', emailLimpo)
                        .eq('ativo', true)
                        .maybeSingle();

                    if (!errDb && usuario) {
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
                } else {
                    const { data: usuariosCadastrados, error: errDb } = await supabase
                        .from('usuarios')
                        .select('id, nome, email, senha_hash, pin_hash, role')
                        .eq('ativo', true);

                    if (!errDb && Array.isArray(usuariosCadastrados) && usuariosCadastrados.length > 0) {
                        for (const u of usuariosCadastrados) {
                            const hash = u.senha_hash || u.pin_hash;
                            const match = await bcrypt.compare(senhaLimpa, hash);
                            if (match) {
                                usuarioAutenticado = {
                                    id: u.id,
                                    nome: u.nome,
                                    email: u.email,
                                    role: u.role
                                };
                                break;
                            }
                        }
                    }
                }
            } catch (errDb) {
                // Tabela ainda não existe ou erro de conexão — segue para o fallback
            }

            // 2. Fallback Gracioso: se não encontrou usuário no banco, testa contra senhas do .env
            if (!usuarioAutenticado) {
                if (timingSafeMatch(senhaLimpa, config.pinSupervisor)) {
                    usuarioAutenticado = {
                        id: 'supervisor-master',
                        nome: 'Supervisor AutoCar',
                        email: emailLimpo || 'supervisor@autocarbs.com.br',
                        role: 'supervisor'
                    };
                } else if (timingSafeMatch(senhaLimpa, config.pinAcesso)) {
                    usuarioAutenticado = {
                        id: 'operador-master',
                        nome: 'Operador Oficina',
                        email: emailLimpo || 'operador@autocarbs.com.br',
                        role: 'operador'
                    };
                }
            }

            // Se nenhum bateu, rejeita login
            if (!usuarioAutenticado) {
                return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos!' });
            }

            // Gera token com identidade e role para RBAC
            const token = gerarTokenSessao(usuarioAutenticado);

            // Registra login na trilha de auditoria (em background)
            auditoriaService.registrar({
                usuario: usuarioAutenticado,
                acao: 'LOGIN',
                tabela: 'usuarios',
                registroId: usuarioAutenticado.id,
                detalhes: { ip: req.ip || req.connection.remoteAddress }
            });

            return res.json({
                success: true,
                token,
                usuario: usuarioAutenticado
            });
        } catch (err) {
            next(err);
        }
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
