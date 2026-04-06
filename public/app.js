/* ── Estado ── */
let ws = null;
let myUsername = "";
let myColor = "#7c6aff";
let typingTimeout = null;
let isTyping = false;
const typingUsers = new Map(); // username → { color, timer }

/* ── DOM ── */
const messagesEl = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");
const userListEl = document.getElementById("user-list");
const userCountEl = document.getElementById("user-count");
const myNameEl = document.getElementById("my-name");
const myAvatarEl = document.getElementById("my-avatar");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const typingBar = document.getElementById("typing-bar");
const renameBtn = document.getElementById("rename-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalInput = document.getElementById("modal-input");
const modalConfirm = document.getElementById("modal-confirm");
const modalCancel = document.getElementById("modal-cancel");

/* ── Helpers ── */
function getInitials(name) {
  return name.slice(0, 2).toUpperCase();
}

function setStatus(connected) {
  if (connected) {
    statusDot.classList.add("connected");
    statusText.textContent = "Conectado";
  } else {
    statusDot.classList.remove("connected");
    statusText.textContent = "Desconectado";
  }
}

function renderUserList(users) {
  userCountEl.textContent = users.length;
  userListEl.innerHTML = "";
  users.forEach(({ username, color }) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="user-dot" style="background:${color}; box-shadow:0 0 6px ${color}"></span>
      <span>${username}</span>
      ${username === myUsername ? '<span class="user-tag">tú</span>' : ""}
    `;
    userListEl.appendChild(li);
  });
}

function setMyProfile(username, color) {
  myUsername = username;
  myColor = color;
  myNameEl.textContent = username;
  myAvatarEl.textContent = getInitials(username);
  myAvatarEl.style.background = color;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ── Render mensajes ── */
function appendMessage({ username, color, text, time, own }) {
  const div = document.createElement("div");
  div.className = `msg ${own ? "own" : "other"}`;
  div.innerHTML = `
    ${
      !own
        ? `<div class="msg-meta">
      <span class="msg-author" style="color:${color}">${username}</span>
    </div>`
        : ""
    }
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <span class="msg-time">${time}</span>
  `;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function appendSystem(text) {
  const div = document.createElement("div");
  div.className = "msg-system";
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Typing indicator ── */
function updateTypingBar() {
  const names = Array.from(typingUsers.keys());
  if (names.length === 0) {
    typingBar.textContent = "";
  } else if (names.length === 1) {
    typingBar.textContent = `${names[0]} está escribiendo…`;
  } else {
    typingBar.textContent = `${names.join(", ")} están escribiendo…`;
  }
}

/* ── WebSocket ── */
function connect() {
  const wsUrl = "ws://localhost:3000";
  ws = new WebSocket(wsUrl);

  ws.addEventListener("open", () => {
    setStatus(true);
  });

  ws.addEventListener("close", () => {
    setStatus(false);
    appendSystem("Conexión perdida. Reconectando en 3s…");
    setTimeout(connect, 3000);
  });

  ws.addEventListener("error", () => {
    ws.close();
  });

  ws.addEventListener("message", (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    handleMessage(data);
  });
}

function handleMessage(data) {
  switch (data.type) {
    case "welcome":
      setMyProfile(data.username, data.color);
      renderUserList(data.users);
      appendSystem("¡Bienvenido al chat!");
      break;

    case "message":
      appendMessage({
        username: data.username,
        color: data.color,
        text: data.text,
        time: data.time,
        own: data.username === myUsername,
      });
      // Limpiar typing de ese usuario al recibir mensaje
      if (typingUsers.has(data.username)) {
        clearTimeout(typingUsers.get(data.username).timer);
        typingUsers.delete(data.username);
        updateTypingBar();
      }
      break;

    case "system":
      appendSystem(data.text);
      if (data.users) renderUserList(data.users);
      break;

    case "renamed":
      myUsername = data.username;
      myNameEl.textContent = data.username;
      myAvatarEl.textContent = getInitials(data.username);
      break;

    case "typing":
      if (data.username === myUsername) break;
      if (data.isTyping) {
        if (typingUsers.has(data.username)) {
          clearTimeout(typingUsers.get(data.username).timer);
        }
        const timer = setTimeout(() => {
          typingUsers.delete(data.username);
          updateTypingBar();
        }, 3000);
        typingUsers.set(data.username, { color: data.color, timer });
      } else {
        if (typingUsers.has(data.username)) {
          clearTimeout(typingUsers.get(data.username).timer);
          typingUsers.delete(data.username);
        }
      }
      updateTypingBar();
      break;
  }
}

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "message", text }));
  msgInput.value = "";
  // Parar typing
  if (isTyping) {
    isTyping = false;
    ws.send(JSON.stringify({ type: "typing", isTyping: false }));
  }
}

/* ── Eventos ── */
sendBtn.addEventListener("click", sendMessage);

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

msgInput.addEventListener("input", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!isTyping) {
    isTyping = true;
    ws.send(JSON.stringify({ type: "typing", isTyping: true }));
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    ws.send(JSON.stringify({ type: "typing", isTyping: false }));
  }, 2500);
});

// Modal
renameBtn.addEventListener("click", () => {
  modalInput.value = myUsername;
  modalOverlay.classList.add("active");
  modalInput.focus();
  modalInput.select();
});

modalCancel.addEventListener("click", () => {
  modalOverlay.classList.remove("active");
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove("active");
});

modalConfirm.addEventListener("click", () => {
  const newName = modalInput.value.trim();
  if (newName && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "rename", username: newName }));
  }
  modalOverlay.classList.remove("active");
});

modalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") modalConfirm.click();
  if (e.key === "Escape") modalCancel.click();
});

/* ── Init ── */
connect();
