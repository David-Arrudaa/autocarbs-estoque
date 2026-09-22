const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { loginLimiter, autenticarRequisicao } = require('../../middlewares/auth');

// Rota de login protegida por limitador de tentativas
router.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));

// Rota de logout — invalida o cookie de sessão no servidor
router.post('/logout', (req, res) => authController.logout(req, res));

// Rota para checagem rápida de sessão
router.get('/me', autenticarRequisicao, (req, res) => authController.verificarSessao(req, res));

module.exports = router;
