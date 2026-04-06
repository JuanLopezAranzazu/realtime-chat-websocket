const ws = new WebSocket("ws://localhost:8080");

ws.onopen = () => {
  console.log("Conectado al servidor WebSocket");
};

ws.onmessage = (event) => {
  const messages = document.getElementById("messages");
  const newMessage = document.createElement("div");
  newMessage.textContent = `Servidor: ${event.data}`;
  messages.appendChild(newMessage);
};

ws.onclose = () => {
  console.log("Desconectado del servidor WebSocket");
};

document.getElementById("send").addEventListener("click", () => {
  const input = document.getElementById("message");
  ws.send(input.value);
  input.value = "";
});
