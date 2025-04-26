const { escolhaModel } = require('../models/escolha');
const { adicionarNaFila, getStatusFila } = require('../config/queue');

function configurarSocketHandlers(io, monitor) {
    io.on('connection', (socket) => {
        console.log('Novo cliente conectado');

        socket.on('entrarFila', async (data) => {
            try {
                const { nomeCompleto, turma, dadosEscolha } = data;
                // ...existing socket logic...
            } catch (error) {
                // ...error handling...
            }
        });

        socket.on('disconnect', () => {
            console.log('Cliente desconectado');
        });
    });
}

module.exports = { configurarSocketHandlers };