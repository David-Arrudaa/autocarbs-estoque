const express = require('express');
const router = express.Router();
const estoqueController = require('./estoque.controller');
const { autenticarRequisicao, supervisorLimiter, apiLimiter } = require('../../middlewares/auth');

// Todas as rotas do módulo de estoque requerem autenticação + rate limit
router.use(autenticarRequisicao);
router.use(apiLimiter);

// Consulta e estatísticas
router.get('/', (req, res, next) => estoqueController.listar(req, res, next));
router.get('/stats', (req, res, next) => estoqueController.stats(req, res, next));
router.get('/curva-abc', (req, res, next) => estoqueController.curvaABC(req, res, next));
router.get('/relatorio', (req, res, next) => estoqueController.relatorio(req, res, next));

// Cadastro e atualização
router.post('/', (req, res, next) => estoqueController.criar(req, res, next));
router.put('/:id', (req, res, next) => estoqueController.atualizar(req, res, next));

// Movimentações de estoque
router.post('/:id/entrada', (req, res, next) => estoqueController.registrarEntrada(req, res, next));
router.post('/:id/saida', (req, res, next) => estoqueController.registrarSaida(req, res, next));
router.post('/sincronizar-cotacao', (req, res, next) => estoqueController.sincronizarCotacao(req, res, next));

// Exclusão protegida por rate limiter e senha de supervisor
router.delete('/:id', supervisorLimiter, (req, res, next) => estoqueController.excluir(req, res, next));

module.exports = router;

