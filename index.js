const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');
const { Server } = require('socket.io');

// Configuração do Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.PROJECT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    // Garante que as quebras de linha da chave privada sejam lidas corretamente
    privateKey: process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  }),
  databaseURL: "https://logdesempenhodevice-default-rtdb.firebaseio.com",
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public')); // Serve seu HTML/JS da pasta public

const db = admin.database();
const logsRef = db.ref('logsite_teste'); // Nome da tabela atualizado conforme seu Kotlin

// ✅ WebSocket: Notificar quando qualquer dado de qualquer dispositivo mudar
logsRef.on('value', (snapshot) => {
  const data = snapshot.val();
  console.log('🔄 Dados atualizados no Firebase, enviando para clientes...');
  io.emit('atualizacao_logs', data); 
});

// ✅ Rota REST: Pegar todos os dispositivos e seus status atuais
app.get('/api/logs', async (req, res) => {
  try {
    const snapshot = await logsRef.once('value');
    const data = snapshot.val();
    
    // Opcional: Se quiser formatar os dados antes de enviar para o site
    res.json(data);
  } catch (error) {
    console.error("Erro ao buscar logs:", error);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

// ✅ Rota REST: Pegar histórico ou status de um dispositivo específico
app.get('/api/logs/:deviceId', async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    // Note que agora buscamos em 'logsite_teste' e não mais em 'logs'
    const snapshot = await db.ref(`logsite_teste/${deviceId}`).once('value');
    
    if (!snapshot.exists()) {
        return res.status(404).json({ error: "Dispositivo não encontrado" });
    }
    
    res.json(snapshot.val());
  } catch (error) {
    console.error("Erro ao buscar logs por device:", error);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

// ✅ WebSocket: Log de conexão do painel web
io.on('connection', (socket) => {
  console.log('✅ Um painel de controle conectou-se via WebSocket');
  
  // Envia os dados imediatamente ao conectar para o site não ficar em branco
  logsRef.once('value').then((snapshot) => {
    socket.emit('atualizacao_logs', snapshot.val());
  });
});

// ✅ Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Monitorando nó: logsite_teste`);
});