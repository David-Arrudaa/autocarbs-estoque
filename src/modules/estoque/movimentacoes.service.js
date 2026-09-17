const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const supabase = require('../../config/supabase');

const DATA_DIR = path.join(__dirname, '../../../data');
const FILE_PATH = path.join(DATA_DIR, 'movimentacoes.json');

class MovimentacoesService {
    constructor() {
        this.cache = null;
        this.salvando = false;
        this.inicializar();
    }

    /**
     * Garante existência do diretório e carrega cache em memória
     */
    inicializar() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }
            if (fs.existsSync(FILE_PATH)) {
                const raw = fs.readFileSync(FILE_PATH, 'utf-8');
                this.cache = JSON.parse(raw);
            } else {
                this.cache = [];
                fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
            }
        } catch (err) {
            console.error('[MovimentacoesService] Erro ao inicializar cache de movimentações:', err.message);
            this.cache = [];
        }
    }

    /**
     * Persiste o cache em disco de forma segura e não bloqueante
     */
    async persistir() {
        if (this.salvando) return;
        this.salvando = true;
        try {
            if (!fs.existsSync(DATA_DIR)) {
                await fs.promises.mkdir(DATA_DIR, { recursive: true });
            }
            const tmpFile = `${FILE_PATH}.tmp_${Date.now()}`;
            await fs.promises.writeFile(tmpFile, JSON.stringify(this.cache, null, 2), 'utf-8');
            await fs.promises.rename(tmpFile, FILE_PATH);
        } catch (err) {
            console.error('[MovimentacoesService] Falha ao persistir movimentações em disco:', err.message);
        } finally {
            this.salvando = false;
        }
    }

    /**
     * Registra uma movimentação de estoque (saída de venda, cotação, etc.)
     */
    async registrarMovimento({
        produtoId,
        qtd,
        isVenda = true,
        tipo = '',
        modelo = '',
        marca = '',
        codigo = '',
        valorUnitario = 0,
        origem = 'MANUAL',
        veiculo = null,
        timestamp = new Date().toISOString()
    }) {
        if (!this.cache) this.inicializar();

        const qtdNum = Number(qtd) || 0;
        const vlrUnit = Number(valorUnitario) || 0;
        const movimento = {
            id: `mov_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            produtoId: String(produtoId),
            tipo: String(tipo || '').trim().toUpperCase(),
            modelo: String(modelo || '').trim(),
            marca: String(marca || '').trim(),
            codigo: String(codigo || '').trim(),
            qtd: qtdNum,
            valorUnitario: vlrUnit,
            valorTotal: qtdNum * vlrUnit,
            isVenda: Boolean(isVenda),
            origem: String(origem || 'MANUAL'),
            veiculo: veiculo || null,
            timestamp: timestamp || new Date().toISOString()
        };

        this.cache.push(movimento);
        await this.persistir();

        // Opcional: tenta registrar no Supabase caso a tabela exista
        try {
            await supabase.from('movimentacoes').insert([{
                produto_id: movimento.produtoId,
                qtd: movimento.qtd,
                is_venda: movimento.isVenda,
                origem: movimento.origem,
                criado_em: movimento.timestamp
            }]);
        } catch (_) {
            // Silencioso se tabela não existir
        }

        return movimento;
    }

    /**
     * Retorna todas as movimentações dentro de um período
     */
    obterMovimentos({ de, ate, produtoId = null } = {}) {
        if (!this.cache) this.inicializar();

        let dataInicio = de ? new Date(de) : null;
        let dataFim = ate ? new Date(ate) : null;

        return this.cache.filter(m => {
            if (!m.isVenda) return false;
            if (produtoId && String(m.produtoId) !== String(produtoId)) return false;

            const dataMov = new Date(m.timestamp);
            if (dataInicio && dataMov < dataInicio) return false;
            if (dataFim && dataMov > dataFim) return false;

            return true;
        });
    }

    /**
     * Calcula as métricas agregadas de saídas para uma lista de produtos por período
     * @param {Object} params
     * @param {string} params.periodo - 'anual' | '30dias' | '90dias' | 'personalizado'
     * @param {string} [params.de] - YYYY-MM-DD
     * @param {string} [params.ate] - YYYY-MM-DD
     * @param {Array} params.produtos - Lista de produtos do catálogo
     */
    calcularMetricasPeriodo({ periodo = 'anual', de = null, ate = null, produtos = [] }) {
        if (!this.cache) this.inicializar();

        const agora = new Date();
        let dataInicio = null;
        let dataFim = null;
        let rotuloPeriodo = 'Anual (Consolidado)';

        if (periodo === '30dias') {
            dataInicio = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
            dataFim = new Date();
            rotuloPeriodo = 'Últimos 30 Dias';
        } else if (periodo === '90dias') {
            dataInicio = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000);
            dataFim = new Date();
            rotuloPeriodo = 'Últimos 90 Dias';
        } else if (periodo === 'personalizado') {
            if (de) {
                const [y, m, d] = de.split('-').map(Number);
                dataInicio = new Date(y, m - 1, d, 0, 0, 0, 0);
            }
            if (ate) {
                const [y, m, d] = ate.split('-').map(Number);
                dataFim = new Date(y, m - 1, d, 23, 59, 59, 999);
            } else {
                dataFim = new Date();
            }
            rotuloPeriodo = `Personalizado (${de || 'Início'} até ${ate || 'Hoje'})`;
        } else {
            // Anual
            rotuloPeriodo = `Ano ${agora.getFullYear()} (Consolidado)`;
        }

        // Agrupa movimentações de venda por produtoId
        const agrupado = {};
        if (dataInicio || dataFim) {
            const movs = this.obterMovimentos({ de: dataInicio, ate: dataFim });
            for (const m of movs) {
                const pid = String(m.produtoId);
                if (!agrupado[pid]) {
                    agrupado[pid] = { saidas: 0, faturamento: 0 };
                }
                agrupado[pid].saidas += Number(m.qtd) || 0;
                agrupado[pid].faturamento += Number(m.valorTotal) || ((Number(m.qtd) || 0) * (Number(m.valorUnitario) || 0));
            }
        }

        // Mapeia produtos aplicando as métricas do período
        const ranking = [];
        for (const p of produtos) {
            const venda = Number(p.venda) || 0;
            const compra = Number(p.compra) || 0;
            const qtd = Number(p.qtd) || 0;
            const minimo = Number(p.minimo) || 0;

            let saidas = 0;
            let faturamento = 0;

            if (periodo === 'anual') {
                // No período anual, se houver movimentações datadas no ano usamos o maior entre p.saidas e as movimentações
                const pid = String(p.id);
                const doPeriodo = agrupado[pid]?.saidas || 0;
                saidas = Math.max(Number(p.saidas) || 0, doPeriodo);
                faturamento = saidas * venda;
            } else {
                // Período específico (30dias, 90dias, personalizado)
                const pid = String(p.id);
                saidas = agrupado[pid]?.saidas || 0;
                faturamento = agrupado[pid]?.faturamento || (saidas * venda);
            }

            if (saidas > 0) {
                ranking.push({
                    id: p.id,
                    tipo: p.tipo,
                    marca: p.marca,
                    modelo: p.modelo,
                    codigo: p.codigo,
                    qtd,
                    minimo,
                    compra,
                    venda,
                    saidas,
                    faturamento,
                    periodoSaidas: saidas,
                    periodoFaturamento: faturamento
                });
            }
        }

        // Ordena inicialmente por saídas decrescente
        ranking.sort((a, b) => b.saidas - a.saidas);

        return {
            periodo,
            rotuloPeriodo,
            dataInicio: dataInicio ? dataInicio.toISOString() : null,
            dataFim: dataFim ? dataFim.toISOString() : null,
            totalItensComSaida: ranking.length,
            ranking
        };
    }
}

module.exports = new MovimentacoesService();

