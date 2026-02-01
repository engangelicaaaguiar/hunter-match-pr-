
const express = require('express');
const path = require('path');
const app = express();

// O Cloud Run injeta a porta na variável de ambiente PORT. Caso não exista, usa 8080.
const port = process.env.PORT || 8080;

// Serve os arquivos estáticos da raiz (onde está o index.html)
app.use(express.static(__dirname));

// Roteamento para SPA (redireciona todas as rotas para o index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ESCUTA EM 0.0.0.0 conforme exigido por ambientes de container/cloud
app.listen(port, '0.0.0.0', () => {
  console.log(`HunterMatch PRO rodando com sucesso na porta ${port}`);
});
