/**
 * Middleware global de tratamento de erros.
 *
 * Separa erros "seguros" (que podem ser mostrados ao usuário) de erros internos
 * (que ficam apenas nos logs do servidor). Isso evita vazar informações de
 * estrutura interna do banco ou do Supabase para clientes externos.
 */
function errorHandler(err, req, res, next) {
    // Sempre loga o erro completo no servidor (com stack trace)
    console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path}:`, err);

    const status = err.status || 500;

    // Erros com status < 500 são erros de negócio/validação — podem ir para o cliente
    const isSafeError = status < 500;

    const clientMessage = isSafeError
        ? err.message
        : 'Ocorreu um erro interno. Tente novamente ou contate o suporte.';

    res.status(status).json({
        success: false,
        error: clientMessage,
        // Stack trace APENAS em desenvolvimento — nunca em produção
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack, _internal: err.message })
    });
}

module.exports = errorHandler;
