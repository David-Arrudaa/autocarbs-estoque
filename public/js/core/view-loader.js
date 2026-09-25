/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Core Engine: ViewLoader (Carregamento de Módulos Dinâmicos)
 * =========================================================
 * Permite uma arquitetura SPA ultra-organizada e modular, onde
 * cada módulo (Estoque, Cotação, Equipe, Scanner, etc.) tem
 * seu próprio arquivo HTML (.view.html), sem inflar o index.html.
 */

const ViewLoader = {
    _cache: new Map(),
    _loadedModules: new Set(),

    /**
     * Carrega o fragmento HTML de um módulo e injeta no container do DOM.
     * @param {string} moduleName Nome da pasta/módulo (ex: 'cotacao', 'equipe')
     * @param {string} targetId ID do container onde o HTML será injetado
     * @param {string} [customFileName] Nome customizado do arquivo se diferente de <moduleName>.view.html
     * @returns {Promise<boolean>}
     */
    async loadView(moduleName, targetId, customFileName = null) {
        const container = document.getElementById(targetId);
        if (!container) {
            console.warn(`[ViewLoader] Container #${targetId} não encontrado no DOM.`);
            return false;
        }

        // Se já foi populado com conteúdo real e não está vazio, evita trabalho desnecessário
        if (this._loadedModules.has(`${moduleName}:${targetId}`) && container.children.length > 0) {
            return true;
        }

        const fileName = customFileName || `${moduleName}.view.html`;
        const path = `modules/${moduleName}/${fileName}?_t=${Date.now()}`;

        try {
            let html = null;
            if (!html) {
                const res = await fetch(path, { cache: 'no-store' });
                if (!res.ok) {
                    throw new Error(`Falha HTTP ao carregar view [${res.status}]: ${path}`);
                }
                html = await res.text();
            }

            container.innerHTML = html;
            this._loadedModules.add(`${moduleName}:${targetId}`);

            // Dispara evento global de módulo carregado
            window.dispatchEvent(new CustomEvent('view:loaded', {
                detail: { module: moduleName, targetId }
            }));

            return true;
        } catch (err) {
            console.error(`[ViewLoader] Erro ao carregar view "${moduleName}":`, err);
            return false;
        }
    },

    /**
     * Carrega múltiplos módulos em paralelo na inicialização
     * @param {Array<{module: string, targetId: string, customFileName?: string}>} modules
     */
    async loadAll(modules) {
        return Promise.all(modules.map(m => this.loadView(m.module, m.targetId, m.customFileName)));
    }
};

window.ViewLoader = ViewLoader;
