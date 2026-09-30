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

    /** Skeleton HTML exibido enquanto o módulo real carrega */
    _skeletonHTML: `
        <div class="vl-skeleton-wrapper">
            <div class="vl-skeleton-toolbar">
                <div class="vl-sk vl-sk-search"></div>
                <div class="vl-sk vl-sk-btn"></div>
                <div class="vl-sk vl-sk-btn vl-sk-btn-sm"></div>
            </div>
            <div class="vl-skeleton-table">
                <div class="vl-sk vl-sk-header"></div>
                <div class="vl-sk vl-sk-row"></div>
                <div class="vl-sk vl-sk-row vl-sk-row-alt"></div>
                <div class="vl-sk vl-sk-row"></div>
                <div class="vl-sk vl-sk-row vl-sk-row-alt"></div>
                <div class="vl-sk vl-sk-row"></div>
                <div class="vl-sk vl-sk-row vl-sk-row-alt"></div>
                <div class="vl-sk vl-sk-row"></div>
            </div>
        </div>
    `,

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

        // Exibe skeleton enquanto carrega
        container.innerHTML = this._skeletonHTML;

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
            container.innerHTML = '';
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
