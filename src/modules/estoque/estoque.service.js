/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Service: EstoqueService (Regras de Negócio & Cálculos)
 * =========================================================
 * Isola toda a lógica de negócio, estatísticas, consolidação
 * financeira de relatórios e cálculos de margem/markup de estoque.
 */

class EstoqueService {
    /**
     * Margem de lucro padrão sugerida pela oficina (85%)
     */
    static MARGEM_PADRAO_PERCENTUAL = 85;

    /**
     * Calcula o preço de venda recomendado a partir do custo e margem
     * @param {number} custo Custo de compra da peça
     * @param {number} [margemPercentual=85] Margem desejada em percentual
     * @returns {number} Preço de venda sugerido arredondado em 2 casas decimais
     */
    static calcularPrecoVendaSugerido(custo, margemPercentual = EstoqueService.MARGEM_PADRAO_PERCENTUAL) {
        const c = Number(custo) || 0;
        if (c <= 0) return 0;
        const fator = 1 + (Number(margemPercentual) / 100);
        return Math.round(c * fator * 100) / 100;
    }

    /**
     * Calcula as métricas consolidadas do estoque (valor total, reposição, ranking de vendas)
     * @param {Array} produtos Lista de produtos
     * @returns {Object} { valorTotalEstoque, totalItens, reposicao, ranking }
     */
    static processarEstatisticas(produtos = []) {
        let valorTotalEstoque = 0;
        const totalItens = produtos.length;
        const reposicao = [];
        const ranking = [];

        for (const p of produtos) {
            const qtd = Number(p.qtd) || 0;
            const compra = Number(p.compra) || 0;
            const minimo = Number(p.minimo) || 0;
            const saidas = Number(p.saidas) || 0;

            valorTotalEstoque += compra * qtd;

            if (qtd < minimo) {
                reposicao.push(p);
            }
            if (saidas > 0) {
                ranking.push(p);
            }
        }

        ranking.sort((a, b) => (b.saidas || 0) - (a.saidas || 0));

        return {
            valorTotalEstoque,
            totalItens,
            reposicao,
            ranking
        };
    }

    /**
     * Consolida os dados financeiros e agregados para o Relatório Estratégico
     * @param {Array} produtos 
     * @param {Object} filtros 
     */
    static processarRelatorio(produtos = [], filtros = {}) {
        const { status } = filtros;
        let lista = [...produtos];

        if (status === 'zerado') {
            lista = lista.filter(p => Number(p.qtd) === 0);
        } else if (status === 'repor') {
            lista = lista.filter(p => Number(p.qtd) < Number(p.minimo));
        } else if (status === 'positivo') {
            lista = lista.filter(p => Number(p.qtd) > 0);
        }

        let totalItens = lista.length;
        let totalUnidadesFisicas = 0;
        let totalCusto = 0;
        let totalVendaPotencial = 0;
        let totalLucroPotencial = 0;

        const porTipoMap = {};
        const porMarcaMap = {};
        const porModeloMap = {};

        const produtosMapeados = lista.map(p => {
            const qtd = Number(p.qtd) || 0;
            const minimo = Number(p.minimo) || 0;
            const compra = Number(p.compra) || 0;
            const venda = Number(p.venda) || 0;
            const saidas = Number(p.saidas) || 0;

            const custoItemTotal = compra * qtd;
            const vendaItemTotal = venda * qtd;
            const lucroItemTotal = vendaItemTotal - custoItemTotal;
            const margemItem = compra > 0 ? ((venda - compra) / compra) * 100 : 0;

            totalUnidadesFisicas += qtd;
            totalCusto += custoItemTotal;
            totalVendaPotencial += vendaItemTotal;
            totalLucroPotencial += lucroItemTotal;

            const tipoKey = String(p.tipo || 'OUTROS').trim().toUpperCase();
            if (!porTipoMap[tipoKey]) {
                porTipoMap[tipoKey] = { tipo: tipoKey, qtdTotal: 0, custoTotal: 0, vendaTotal: 0, lucroTotal: 0, totalItens: 0 };
            }
            porTipoMap[tipoKey].totalItens += 1;
            porTipoMap[tipoKey].qtdTotal += qtd;
            porTipoMap[tipoKey].custoTotal += custoItemTotal;
            porTipoMap[tipoKey].vendaTotal += vendaItemTotal;
            porTipoMap[tipoKey].lucroTotal += lucroItemTotal;

            const marcaKey = String(p.marca || 'SEM MARCA').trim().toUpperCase();
            if (!porMarcaMap[marcaKey]) {
                porMarcaMap[marcaKey] = { marca: marcaKey, qtdTotal: 0, custoTotal: 0, vendaTotal: 0, lucroTotal: 0, totalItens: 0 };
            }
            porMarcaMap[marcaKey].totalItens += 1;
            porMarcaMap[marcaKey].qtdTotal += qtd;
            porMarcaMap[marcaKey].custoTotal += custoItemTotal;
            porMarcaMap[marcaKey].vendaTotal += vendaItemTotal;
            porMarcaMap[marcaKey].lucroTotal += lucroItemTotal;

            const modeloKey = String(p.modelo || 'GERAL').trim().toUpperCase();
            if (!porModeloMap[modeloKey]) {
                porModeloMap[modeloKey] = { modelo: modeloKey, qtdTotal: 0, custoTotal: 0, vendaTotal: 0, lucroTotal: 0, totalItens: 0 };
            }
            porModeloMap[modeloKey].totalItens += 1;
            porModeloMap[modeloKey].qtdTotal += qtd;
            porModeloMap[modeloKey].custoTotal += custoItemTotal;
            porModeloMap[modeloKey].vendaTotal += vendaItemTotal;
            porModeloMap[modeloKey].lucroTotal += lucroItemTotal;

            return {
                id: p.id,
                tipo: p.tipo,
                marca: p.marca || '',
                modelo: p.modelo || '',
                codigo: p.codigo || '',
                qtd,
                minimo,
                saidas,
                compra,
                venda,
                custoTotal: custoItemTotal,
                vendaTotal: vendaItemTotal,
                lucroTotal: lucroItemTotal,
                margemPercentual: margemItem,
                statusEstoque: qtd === 0 ? 'zerado' : (qtd < minimo ? 'repor' : 'normal')
            };
        });

        const margemMediaPercentual = totalCusto > 0
            ? ((totalVendaPotencial - totalCusto) / totalCusto) * 100
            : 0;

        return {
            resumo: {
                totalItens,
                totalUnidadesFisicas,
                totalCusto,
                totalVendaPotencial,
                totalLucroPotencial,
                margemMediaPercentual
            },
            porTipo: Object.values(porTipoMap).sort((a, b) => b.custoTotal - a.custoTotal),
            porMarca: Object.values(porMarcaMap).sort((a, b) => b.custoTotal - a.custoTotal),
            porModelo: Object.values(porModeloMap).sort((a, b) => b.custoTotal - a.custoTotal),
            produtos: produtosMapeados
        };
    }
}

module.exports = EstoqueService;
