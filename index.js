const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');
const { Server } = require('socket.io');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.PROJECT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
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
app.use(express.static('public')); // ✅ Serve arquivos estáticos

const db = admin.database();
const logsRef = db.ref('logs');

// ✅ Escutar alterações e notificar via WebSocket
logsRef.on('child_added', (snapshot) => {
  console.log('📥 Nova log detectada:', snapshot.key);
  io.emit('nova_log', snapshot.key);
});

// ✅ Rotas REST
app.get('/api/logs', async (req, res) => {
  try {
    const snapshot = await logsRef.once('value');
    res.json(snapshot.val());
  } catch (error) {
    console.error("Erro ao buscar logs:", error);
    res.status(500).send('Erro ao buscar logs');
  }
});

app.get('/api/logs/:deviceId', async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const snapshot = await db.ref(`logs/${deviceId}`).once('value');
    res.json(snapshot.val());
  } catch (error) {
    console.error("Erro ao buscar logs por device:", error);
    res.status(500).send('Erro ao buscar logs');
  }
});

// ✅ WebSocket: cliente conectado
io.on('connection', (socket) => {
  console.log('✅ Novo cliente conectado via WebSocket');
});

// ✅ Iniciar servidor
server.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});