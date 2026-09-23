/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Cliente de API HTTP (Comunicação com o Servidor Node.js)
 * =========================================================
 */

const API = {
    BASE_URL: '/api',

    /**
     * O token de sessão agora viaja em cookie HttpOnly definido pelo servidor.
     * O browser envia o cookie automaticamente em cada requisição (credentials: 'include').
     * getToken() retorna null — mantido apenas para compatibilidade com código legado.
     */
    getToken() {
        return null;
    },

    /**
     * setToken(null) é chamado no logout para limpar qualquer token legado do localStorage.
     * O cookie HttpOnly é limpo pelo endpoint POST /api/auth/logout no servidor.
     */
    setToken(token) {
        if (!token) {
            // Remove token legado caso ainda exista no localStorage de sessões antigas
            localStorage.removeItem('autocar_token');
        }
    },

    async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Bearer header como fallback para compatibilidade com tokens legados
        const legacyToken = localStorage.getItem('autocar_token');
        if (legacyToken) {
            headers['Authorization'] = `Bearer ${legacyToken}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include' // OBRIGATÓRIO: envia o cookie HttpOnly em cada request
            });

            // Se a sessão expirou no servidor (exceto tentativa de login e verificação de sessão inicial)
            if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/me')) {
                this.setToken(null);
                window.dispatchEvent(new CustomEvent('auth:expired'));
                throw new Error('Sessão expirada. Faça login novamente.');
            }

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.error || 'Erro ao processar solicitação.');
            }

            return data;
        } catch (err) {
            console.error(`Erro na requisição [${endpoint}]:`, err);
            throw err;
        }
    },

    // --- AUTENTICAÇÃO ---
    async login(emailOuPin, senha) {
        const payload = senha !== undefined 
            ? { email: emailOuPin, senha }
            : (typeof emailOuPin === 'object' ? emailOuPin : { pin: emailOuPin });
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async verificarSessao() {
        return this.request('/auth/me', {
            method: 'GET'
        });
    },

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } catch (e) {
            console.warn('Falha na requisição de logout:', e);
        }
        this.setToken(null);
    },

    // --- ESTOQUE ---
    async listarProdutos(page = 1, limit = 20, busca = '') {
        const query = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            busca: busca || ''
        }).toString();
        return this.request(`/estoque?${query}`, { method: 'GET' });
    },

    async obterStats() {
        return this.request('/estoque/stats', { method: 'GET' });
    },

    async obterCurvaABC(params = {}) {
        const query = new URLSearchParams();
        if (params.periodo) query.append('periodo', params.periodo);
        if (params.de) query.append('de', params.de);
        if (params.ate) query.append('ate', params.ate);
        const qStr = query.toString();
        return this.request(`/estoque/curva-abc${qStr ? '?' + qStr : ''}`, { method: 'GET' });
    },

    async obterRelatorio(filtros = {}) {
        const query = new URLSearchParams(filtros).toString();
        return this.request(`/estoque/relatorio?${query}`, { method: 'GET' });
    },

    async cadastrarProduto(dados) {
        return this.request('/estoque', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
    },

    async atualizarProduto(id, dados) {
        return this.request(`/estoque/${id}`, {
            method: 'PUT',
            body: JSON.stringify(dados)
        });
    },

    async registrarEntrada(id, qtd, devolucao = false) {
        return this.request(`/estoque/${id}/entrada`, {
            method: 'POST',
            body: JSON.stringify({ qtd, devolucao })
        });
    },

    async registrarSaida(id, qtd, venda = true) {
        return this.request(`/estoque/${id}/saida`, {
            method: 'POST',
            body: JSON.stringify({ qtd, venda })
        });
    },

    async excluirProduto(id, senhaSupervisor) {
        return this.request(`/estoque/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ senhaSupervisor })
        });
    },

    async sincronizarCotacao(dados) {
        return this.request('/estoque/sincronizar-cotacao', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
    },

    // ─── MÓDULO DE COTAÇÕES & ORÇAMENTOS ─────────────────────────────────
    async salvarCotacao(dados) {
        return this.request('/cotacoes', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
    },

    async listarCotacoes(busca = '') {
        const q = busca ? `?busca=${encodeURIComponent(busca)}` : '';
        return this.request(`/cotacoes${q}`, { method: 'GET' });
    },

    async obterCotacao(id) {
        return this.request(`/cotacoes/${id}`, { method: 'GET' });
    },

    async excluirCotacao(id) {
        return this.request(`/cotacoes/${id}`, { method: 'DELETE' });
    },

    // ─── MÓDULO DE USUÁRIOS (RBAC) ───────────────────────────────────────
    async listarUsuarios() {
        return this.request('/usuarios', { method: 'GET' });
    },

    async cadastrarUsuario(dados) {
        return this.request('/usuarios', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
    },

    async atualizarUsuario(id, dados) {
        return this.request(`/usuarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(dados)
        });
    },

    async alternarStatusUsuario(id, ativo) {
        return this.request(`/usuarios/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ ativo })
        });
    },

    async alterarSenhaUsuario(id, senha) {
        return this.request(`/usuarios/${id}/senha`, {
            method: 'PUT',
            body: JSON.stringify({ senha })
        });
    },

    async alterarPinUsuario(id, pin) {
        return this.alterarSenhaUsuario(id, pin);
    },

    async excluirUsuario(id) {
        return this.request(`/usuarios/${id}`, {
            method: 'DELETE'
        });
    }
};

window.API = API;

