const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

// Servidor HTTP para servir el frontend
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(data);
  });
});

// Servidor WebSocket
const wss = new WebSocket.Server({ server });

// Almacén de clientes conectados: { ws, username, color }
const clients = new Map();

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFE66D",
  "#A8E6CF",
  "#FF8B94",
  "#B8B8FF",
  "#FFDAC1",
  "#97C1A9",
  "#C9B1FF",
  "#F9C784",
];

let colorIndex = 0;
let userCount = 0;

function broadcast(data, excludeWs = null) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(message);
    }
  });
}

function getUserList() {
  return Array.from(clients.values()).map((c) => ({
    username: c.username,
    color: c.color,
  }));
}

wss.on("connection", (ws) => {
  userCount++;
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  const defaultName = `Usuario${userCount}`;

  clients.set(ws, { username: defaultName, color });

  // Enviar bienvenida al nuevo usuario
  ws.send(
    JSON.stringify({
      type: "welcome",
      username: defaultName,
      color,
      users: getUserList(),
    }),
  );

  // Notificar a todos que alguien se unió
  broadcast(
    {
      type: "system",
      text: `${defaultName} se unió al chat`,
      users: getUserList(),
    },
    ws,
  );

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const client = clients.get(ws);

    if (data.type === "message") {
      if (!data.text || !data.text.trim()) return;
      broadcast({
        type: "message",
        username: client.username,
        color: client.color,
        text: data.text.trim(),
        time: new Date().toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    if (data.type === "rename") {
      const newName = (data.username || "").trim().slice(0, 20);
      if (!newName) return;
      const oldName = client.username;
      client.username = newName;
      broadcast({
        type: "system",
        text: `${oldName} ahora se llama ${newName}`,
        users: getUserList(),
      });
      ws.send(JSON.stringify({ type: "renamed", username: newName }));
    }

    if (data.type === "typing") {
      broadcast(
        {
          type: "typing",
          username: client.username,
          color: client.color,
          isTyping: data.isTyping,
        },
        ws,
      );
    }
  });

  ws.on("close", () => {
    const client = clients.get(ws);
    if (client) {
      clients.delete(ws);
      broadcast({
        type: "system",
        text: `${client.username} salió del chat`,
        users: getUserList(),
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`WebSocket listo en ws://localhost:${PORT}`);
});
