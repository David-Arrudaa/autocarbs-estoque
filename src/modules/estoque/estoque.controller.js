const crypto = require('crypto');
const supabase = require('../../config/supabase');
const config = require('../../config/env');
const auditoriaService = require('../auditoria/auditoria.service');
const movimentacoesService = require('./movimentacoes.service');

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários internos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapa caracteres especiais do operador ILIKE do PostgreSQL (%, _, \).
 * Sem isso, uma busca com "%" retorna todos os registros.
 */
function escaparIlike(valor) {
    return String(valor).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Comparação de PIN em tempo constante (proteção contra timing attacks).
 */
function comparadorSeguro(pinFornecido, pinCorreto) {
    const bufA = Buffer.alloc(64);
    const bufB = Buffer.alloc(64);
    Buffer.from(String(pinFornecido).trim()).copy(bufA);
    Buffer.from(String(pinCorreto).trim()).copy(bufB);
    return crypto.timingSafeEqual(bufA, bufB);
}

class EstoqueController {
    /**
     * Lista produtos com paginação e busca
     */
    async listar(req, res, next) {
        try {
            const page  = Math.max(1, parseInt(req.query.page)  || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const busca = (req.query.busca || '').trim().toUpperCase();

            let query = supabase.from('produtos').select('*', { count: 'exact' });

            if (busca && busca.length >= 2) {
                const b = escaparIlike(busca);
                query = query.or(`tipo.ilike.%${b}%,marca.ilike.%${b}%,modelo.ilike.%${b}%,codigo.ilike.%${b}%`);
            }

            const from = (page - 1) * limit;
            const to   = from + limit - 1;

            const { data, count, error } = await query.range(from, to).order('tipo', { ascending: true });
            if (error) throw error;

            return res.json({
                success: true,
                data: data || [],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limit) || 1
                }
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Retorna os dados estatísticos (Valor Total, Alertas de Reposição e Ranking de Vendas)
     */
    async stats(req, res, next) {
        try {
            const { data, error } = await supabase
                .from('produtos')
                .select('id, tipo, marca, modelo, codigo, qtd, minimo, saidas, compra, venda');

            if (error) throw error;

            const produtos = data || [];
            let valorTotalEstoque = 0;
            let totalItens = produtos.length;

            const reposicao = [];
            const ranking   = [];

            for (const p of produtos) {
                valorTotalEstoque += (Number(p.compra) || 0) * (Number(p.qtd) || 0);

                if (Number(p.qtd) < Number(p.minimo)) {
                    reposicao.push(p);
                }
                if (Number(p.saidas) > 0) {
                    ranking.push(p);
                }
            }

            ranking.sort((a, b) => (b.saidas || 0) - (a.saidas || 0));

            return res.json({
                success: true,
                stats: { valorTotalEstoque, totalItens, reposicao, ranking }
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Retorna dados para a Curva ABC filtrados por período temporal
     * query params: periodo (anual | 30dias | 90dias | personalizado), de (YYYY-MM-DD), ate (YYYY-MM-DD)
     */
    async curvaABC(req, res, next) {
        try {
            const periodo = (req.query.periodo || 'anual').toLowerCase();
            const de = req.query.de || null;
            const ate = req.query.ate || null;

            const { data, error } = await supabase
                .from('produtos')
                .select('id, tipo, marca, modelo, codigo, qtd, minimo, saidas, compra, venda');

            if (error) throw error;

            const resultado = movimentacoesService.calcularMetricasPeriodo({
                periodo,
                de,
                ate,
                produtos: data || []
            });

            return res.json({
                success: true,
                ...resultado
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Gera relatório completo e consolidado de estoque
     */
    async relatorio(req, res, next) {
        try {
            const { tipo, marca, modelo, status } = req.query;

            let query = supabase.from('produtos').select('*').order('tipo', { ascending: true });

            if (tipo && tipo !== 'todos') {
                query = query.ilike('tipo', `%${escaparIlike(tipo.trim())}%`);
            }
            if (marca && marca !== 'todos') {
                query = query.ilike('marca', `%${escaparIlike(marca.trim())}%`);
            }
            if (modelo && modelo !== 'todos') {
                query = query.ilike('modelo', `%${escaparIlike(modelo.trim())}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            let produtos = data || [];

            if (status === 'zerado') {
                produtos = produtos.filter(p => Number(p.qtd) === 0);
            } else if (status === 'repor') {
                produtos = produtos.filter(p => Number(p.qtd) < Number(p.minimo));
            } else if (status === 'positivo') {
                produtos = produtos.filter(p => Number(p.qtd) > 0);
            }

            let totalItens          = produtos.length;
            let totalUnidadesFisicas = 0;
            let totalCusto          = 0;
            let totalVendaPotencial  = 0;
            let totalLucroPotencial  = 0;

            const porTipoMap    = {};
            const porMarcaMap   = {};
            const porModeloMap  = {};
            const tiposDisponiveis   = new Set();
            const marcasDisponiveis  = new Set();
            const modelosDisponiveis = new Set();

            const produtosDetalhados = produtos.map(p => {
                const qtd          = Number(p.qtd)    || 0;
                const minimo       = Number(p.minimo) || 0;
                const compraUnit   = Number(p.compra) || 0;
                const vendaUnit    = Number(p.venda)  || 0;
                const subtotalCusto = qtd * compraUnit;
                const subtotalVenda = qtd * vendaUnit;
                const lucroUnit    = vendaUnit - compraUnit;
                const margemLucro  = compraUnit > 0 ? ((lucroUnit / compraUnit) * 100) : 0;
                const statusEstoque = qtd === 0 ? 'ZERADO' : (qtd < minimo ? 'REPOR' : 'OK');

                totalUnidadesFisicas += qtd;
                totalCusto           += subtotalCusto;
                totalVendaPotencial  += subtotalVenda;
                totalLucroPotencial  += (subtotalVenda - subtotalCusto);

                const t   = String(p.tipo   || 'OUTROS').trim().replace(/\s+/g, ' ').toUpperCase();
                const m   = String(p.marca  || 'SEM MARCA').trim().replace(/\s+/g, ' ').toUpperCase();
                const mod = String(p.modelo || 'SEM MODELO').trim().replace(/\s+/g, ' ').toUpperCase();

                tiposDisponiveis.add(t);
                marcasDisponiveis.add(m);
                if (mod && mod !== 'SEM MODELO') modelosDisponiveis.add(mod);

                if (!porTipoMap[t])
                    porTipoMap[t] = { tipo: t, itensDistintos: 0, unidadesTotais: 0, valorCusto: 0, valorVenda: 0 };
                porTipoMap[t].itensDistintos  += 1;
                porTipoMap[t].unidadesTotais  += qtd;
                porTipoMap[t].valorCusto      += subtotalCusto;
                porTipoMap[t].valorVenda      += subtotalVenda;

                if (!porMarcaMap[m])
                    porMarcaMap[m] = { marca: m, itensDistintos: 0, unidadesTotais: 0, valorCusto: 0, valorVenda: 0 };
                porMarcaMap[m].itensDistintos += 1;
                porMarcaMap[m].unidadesTotais += qtd;
                porMarcaMap[m].valorCusto     += subtotalCusto;
                porMarcaMap[m].valorVenda     += subtotalVenda;

                const chaveModelo = `${mod}___${t}___${m}`;
                if (!porModeloMap[chaveModelo]) {
                    porModeloMap[chaveModelo] = {
                        modelo: mod, tipo: t, marca: m, codigo: p.codigo || '',
                        unidadesTotais: 0, compraUnit, vendaUnit,
                        valorCusto: 0, valorVenda: 0, statusEstoque
                    };
                }
                porModeloMap[chaveModelo].unidadesTotais += qtd;
                porModeloMap[chaveModelo].valorCusto     += subtotalCusto;
                porModeloMap[chaveModelo].valorVenda     += subtotalVenda;

                return {
                    id: p.id, tipo: t, marca: m, modelo: mod,
                    codigo: p.codigo || '', qtd, minimo,
                    compraUnit, vendaUnit, subtotalCusto, subtotalVenda,
                    lucroUnit, margemLucro, statusEstoque
                };
            });

            const porTipo   = Object.values(porTipoMap).sort((a, b) => b.valorCusto - a.valorCusto);
            const porMarca  = Object.values(porMarcaMap).sort((a, b) => b.valorCusto - a.valorCusto);
            const porModelo = Object.values(porModeloMap).sort((a, b) => b.unidadesTotais - a.unidadesTotais || b.valorCusto - a.valorCusto);
            const margemMediaGeral = totalCusto > 0 ? ((totalLucroPotencial / totalCusto) * 100) : 0;

            return res.json({
                success: true,
                relatorio: {
                    geral: {
                        totalItens, totalUnidadesFisicas, totalCusto,
                        totalVendaPotencial, totalLucroPotencial, margemMediaGeral,
                        dataGeracao: new Date().toISOString()
                    },
                    porTipo, porMarca, porModelo, produtos: produtosDetalhados,
                    filtrosDisponiveis: {
                        tipos:   Array.from(tiposDisponiveis).sort(),
                        marcas:  Array.from(marcasDisponiveis).sort(),
                        modelos: Array.from(modelosDisponiveis).sort()
                    }
                }
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Cadastra um novo produto
     */
    async criar(req, res, next) {
        try {
            const { tipo, marca, modelo, codigo, qtd, minimo, compra, venda } = req.body;

            if (!tipo || !String(tipo).trim()) {
                return res.status(400).json({ success: false, error: 'O tipo do produto é obrigatório.' });
            }

            const novoProduto = {
                tipo:   String(tipo).trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 200),
                marca:  String(marca  || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 100),
                modelo: String(modelo || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 100),
                codigo: String(codigo || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 50),
                qtd:    Math.max(0, parseInt(qtd)    || 0),
                minimo: Math.max(0, parseInt(minimo) || 0),
                compra: Math.max(0, parseFloat(compra) || 0),
                venda:  Math.max(0, parseFloat(venda)  || 0),
                saidas: 0
            };

            const { data, error } = await supabase.from('produtos').insert([novoProduto]).select();
            if (error) throw error;

            const criado = data ? data[0] : null;
            auditoriaService.registrar({
                usuario: req.user,
                acao: 'CRIACAO',
                tabela: 'produtos',
                registroId: criado?.id,
                detalhes: { tipo: novoProduto.tipo, modelo: novoProduto.modelo, qtd: novoProduto.qtd, compra: novoProduto.compra, venda: novoProduto.venda }
            });

            return res.status(201).json({
                success: true,
                data: criado,
                message: 'Produto cadastrado com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Atualiza dados de um produto existente
     */
    async atualizar(req, res, next) {
        try {
            const id = req.params.id;
            const { tipo, marca, modelo, codigo, qtd, minimo, compra, venda } = req.body;

            if (!tipo || !String(tipo).trim()) {
                return res.status(400).json({ success: false, error: 'O tipo do produto é obrigatório.' });
            }

            const dadosAtualizados = {
                tipo:   String(tipo).trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 200),
                marca:  String(marca  || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 100),
                modelo: String(modelo || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 100),
                codigo: String(codigo || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 50),
                qtd:    Math.max(0, parseInt(qtd)    || 0),
                minimo: Math.max(0, parseInt(minimo) || 0),
                compra: Math.max(0, parseFloat(compra) || 0),
                venda:  Math.max(0, parseFloat(venda)  || 0)
            };

            const { data, error } = await supabase
                .from('produtos')
                .update(dadosAtualizados)
                .eq('id', id)
                .select();

            if (error) throw error;

            // Se data está vazio, o produto não existe — retornar 404
            if (!data || data.length === 0) {
                return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
            }

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EDICAO',
                tabela: 'produtos',
                registroId: id,
                detalhes: dadosAtualizados
            });

            return res.json({
                success: true,
                data: data[0],
                message: 'Produto atualizado com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Registra movimentação de Entrada no estoque.
     * A operação de soma é atômica via SQL para evitar race conditions.
     */
    async registrarEntrada(req, res, next) {
        try {
            const id         = req.params.id;
            const qtd        = parseInt(req.body.qtd);
            const isDevolucao = Boolean(req.body.devolucao);

            if (!qtd || qtd <= 0) {
                return res.status(400).json({ success: false, error: 'Quantidade informada é inválida.' });
            }

            // Verifica se produto existe antes de operar
            const { data: prod, error: errBusca } = await supabase
                .from('produtos').select('id, qtd, saidas').eq('id', id).single();

            if (errBusca || !prod) {
                return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
            }

            // Operação atômica: incrementa diretamente no banco
            const updatePayload = { qtd: (prod.qtd || 0) + qtd };
            if (isDevolucao) {
                updatePayload.saidas = Math.max(0, (prod.saidas || 0) - qtd);
            }

            const { error: errUpdate } = await supabase
                .from('produtos').update(updatePayload).eq('id', id);

            if (errUpdate) throw errUpdate;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'ENTRADA',
                tabela: 'produtos',
                registroId: id,
                detalhes: { produto: `${prod.tipo} ${prod.modelo || ''}`, qtdAdicionada: qtd, qtdAnterior: prod.qtd, novaQtd: updatePayload.qtd, devolucao: isDevolucao }
            });

            return res.json({
                success: true,
                message: `Entrada de ${qtd} un confirmada com sucesso!`
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Registra movimentação de Saída no estoque.
     * Verifica disponibilidade e opera atomicamente.
     */
    async registrarSaida(req, res, next) {
        try {
            const id     = req.params.id;
            const qtd    = parseInt(req.body.qtd);
            const isVenda = Boolean(req.body.venda);

            if (!qtd || qtd <= 0) {
                return res.status(400).json({ success: false, error: 'Quantidade informada é inválida.' });
            }

            const { data: prod, error: errBusca } = await supabase
                .from('produtos').select('id, qtd, saidas, tipo, modelo, marca, codigo, venda, compra').eq('id', id).single();

            if (errBusca || !prod) {
                return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
            }

            if ((prod.qtd || 0) < qtd) {
                return res.status(400).json({
                    success: false,
                    error: `Estoque insuficiente! Disponível: ${prod.qtd || 0}`
                });
            }

            const updatePayload = { qtd: (prod.qtd || 0) - qtd };
            if (isVenda) {
                updatePayload.saidas = (prod.saidas || 0) + qtd;
            }

            const { error: errUpdate } = await supabase
                .from('produtos').update(updatePayload).eq('id', id);

            if (errUpdate) throw errUpdate;

            if (isVenda) {
                movimentacoesService.registrarMovimento({
                    produtoId: id,
                    qtd,
                    isVenda: true,
                    tipo: prod.tipo,
                    modelo: prod.modelo,
                    marca: prod.marca,
                    codigo: prod.codigo,
                    valorUnitario: Number(prod.venda) || 0,
                    origem: 'MANUAL'
                }).catch(err => console.error('[registrarSaida] Erro ao registrar movimentação:', err));
            }

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'SAIDA',
                tabela: 'produtos',
                registroId: id,
                detalhes: { produto: `${prod.tipo} ${prod.modelo || ''}`, qtdRemovida: qtd, qtdAnterior: prod.qtd, novaQtd: updatePayload.qtd, venda: isVenda }
            });

            return res.json({
                success: true,
                message: `Saída de ${qtd} un realizada com sucesso!`
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Exclui um produto — requer senha de supervisor validada com timingSafeEqual.
     */
    async excluir(req, res, next) {
        try {
            const id = req.params.id;
            const { senhaSupervisor } = req.body;

            if (!senhaSupervisor) {
                return res.status(400).json({ success: false, error: 'Senha de supervisor é obrigatória.' });
            }

            // Comparação segura contra timing attacks
            if (!comparadorSeguro(senhaSupervisor, config.pinSupervisor)) {
                return res.status(403).json({ success: false, error: 'Senha de supervisor incorreta!' });
            }

            // Verifica se produto existe antes de deletar
            const { data: existente, error: errBusca } = await supabase
                .from('produtos').select('id, tipo, modelo').eq('id', id).single();

            if (errBusca || !existente) {
                return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
            }

            const { error } = await supabase.from('produtos').delete().eq('id', id);
            if (error) throw error;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EXCLUSAO',
                tabela: 'produtos',
                registroId: id,
                detalhes: { produto: `${existente.tipo || ''} ${existente.modelo || ''}` }
            });

            return res.json({ success: true, message: 'Produto excluído com sucesso!' });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Sincroniza peças de um orçamento/cotação finalizado com o estoque.
     * Erros por item são coletados e reportados em vez de ser silenciados.
     * Limite máximo de 100 itens por chamada para prevenir DoS.
     */
    async sincronizarCotacao(req, res, next) {
        try {
            const { placa, modelo, itensCompra, itensEstoque } = req.body;

            // Proteção contra DoS por arrays muito grandes
            const MAX_ITENS = 100;
            if (
                (Array.isArray(itensCompra)  && itensCompra.length  > MAX_ITENS) ||
                (Array.isArray(itensEstoque) && itensEstoque.length > MAX_ITENS)
            ) {
                return res.status(400).json({
                    success: false,
                    error: `Máximo de ${MAX_ITENS} itens por sincronização.`
                });
            }

            const placaFmt  = String(placa  || '').trim().toUpperCase().substring(0, 10);
            const modeloFmt = String(modelo || '').trim().toUpperCase().substring(0, 100);

            let entradasRealizadas = 0;
            let saidasRealizadas   = 0;
            let novosCadastrados   = 0;
            const erros            = [];

            // ── 1. Itens comprados de fornecedores → ENTRADA ─────────────────
            if (Array.isArray(itensCompra) && itensCompra.length > 0) {
                for (const item of itensCompra) {
                    const nomeItem  = String(item.name  || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 200);
                    const marcaItem = String(item.brand || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 100);
                    const qtdItem   = Math.max(1, parseInt(item.qty)   || 1);
                    const custoItem = Math.max(0, parseFloat(item.cost)|| 0);
                    const vendaItem = Math.max(0, parseFloat(item.sale)|| 0);

                    if (!nomeItem) continue;

                    try {
                        const { data: existentes, error: errBusca } = await supabase
                            .from('produtos')
                            .select('*')
                            .ilike('tipo', `%${escaparIlike(nomeItem)}%`);

                        if (errBusca) throw errBusca;

                        let produtoExistente = null;
                        if (existentes && existentes.length > 0) {
                            produtoExistente = existentes.find(p =>
                                (marcaItem && p.marca && p.marca.toUpperCase() === marcaItem) ||
                                (modeloFmt && p.modelo && p.modelo.toUpperCase() === modeloFmt)
                            ) || existentes[0];
                        }

                        if (produtoExistente) {
                            const updateData = { qtd: (produtoExistente.qtd || 0) + qtdItem };
                            if (custoItem > 0) updateData.compra = custoItem;
                            if (vendaItem > 0) updateData.venda  = vendaItem;
                            if (!produtoExistente.marca && marcaItem) updateData.marca = marcaItem;

                            const { error: errUpdate } = await supabase
                                .from('produtos').update(updateData).eq('id', produtoExistente.id);

                            if (errUpdate) throw errUpdate;
                        } else {
                            const novoProduto = {
                                tipo:   nomeItem,
                                marca:  marcaItem || 'SEM MARCA',
                                modelo: modeloFmt || '',
                                codigo: '',
                                qtd:    qtdItem,
                                minimo: 1,
                                compra: custoItem,
                                venda:  vendaItem > 0 ? vendaItem : (custoItem > 0 ? Number((custoItem * 1.85).toFixed(2)) : 0),
                                saidas: 0
                            };

                            const { error: errInsert } = await supabase.from('produtos').insert([novoProduto]);
                            if (errInsert) throw errInsert;

                            novosCadastrados++;
                        }

                        entradasRealizadas += qtdItem;
                    } catch (itemErr) {
                        erros.push({ item: nomeItem, erro: 'Falha ao processar entrada' });
                        console.error(`[sincronizarCotacao] Erro ao processar item de compra "${nomeItem}":`, itemErr);
                    }
                }
            }

            // ── 2. Itens do estoque da oficina → SAÍDA ───────────────────────
            if (Array.isArray(itensEstoque) && itensEstoque.length > 0) {
                for (const item of itensEstoque) {
                    const nomeItem = String(item.name || '').trim().replace(/\s+/g, ' ').toUpperCase().substring(0, 200);
                    const qtdItem  = Math.max(1, parseInt(item.qty) || 1);

                    if (!nomeItem) continue;

                    try {
                        const { data: existentes, error: errBusca } = await supabase
                            .from('produtos')
                            .select('id, qtd, saidas, tipo, modelo, marca, codigo, venda, compra')
                            .ilike('tipo', `%${escaparIlike(nomeItem)}%`);

                        if (errBusca) throw errBusca;

                        if (existentes && existentes.length > 0) {
                            const p = existentes[0];
                            const { error: errUpdate } = await supabase
                                .from('produtos')
                                .update({
                                    qtd:    Math.max(0, (p.qtd    || 0) - qtdItem),
                                    saidas: (p.saidas || 0) + qtdItem
                                })
                                .eq('id', p.id);

                            if (errUpdate) throw errUpdate;
                            saidasRealizadas += qtdItem;

                            movimentacoesService.registrarMovimento({
                                produtoId: p.id,
                                qtd: qtdItem,
                                isVenda: true,
                                tipo: p.tipo,
                                modelo: p.modelo || '',
                                marca: p.marca || '',
                                codigo: p.codigo || '',
                                valorUnitario: Number(p.venda) || 0,
                                origem: 'COTACAO',
                                veiculo: `${placaFmt ? placaFmt + ' - ' : ''}${modeloFmt}`
                            }).catch(err => console.error('[sincronizarCotacao] Erro ao registrar movimentação:', err));
                        }
                    } catch (itemErr) {
                        erros.push({ item: nomeItem, erro: 'Falha ao processar saída' });
                        console.error(`[sincronizarCotacao] Erro ao processar item de estoque "${nomeItem}":`, itemErr);
                    }
                }
            }

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'COTACAO_SYNC',
                tabela: 'produtos',
                detalhes: {
                    veiculo: `${placaFmt ? placaFmt + ' - ' : ''}${modeloFmt}`,
                    entradas: entradasRealizadas,
                    novosCadastros: novosCadastrados,
                    saidas: saidasRealizadas,
                    erros: erros.length
                }
            });

            return res.json({
                success: erros.length === 0,
                message: erros.length === 0
                    ? 'Sincronização concluída com sucesso!'
                    : `Sincronização concluída com ${erros.length} erro(s). Verifique os detalhes.`,
                detalhes: {
                    entradas:      entradasRealizadas,
                    novosCadastros: novosCadastrados,
                    saidas:        saidasRealizadas,
                    veiculo:       `${placaFmt ? placaFmt + ' - ' : ''}${modeloFmt}`,
                    erros
                }
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new EstoqueController();
