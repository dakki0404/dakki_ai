const STORAGE_KEY = "dakkiai-chat-v2";
const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

const chat = document.querySelector("#chat");
const welcome = document.querySelector("#welcome");
const composer = document.querySelector("#composer");
const input = document.querySelector("#input");
const sendBtn = document.querySelector("#sendBtn");
const loadBtn = document.querySelector("#loadBtn");
const loadBtnText = document.querySelector("#loadBtnText");
const newChatBtn = document.querySelector("#newChatBtn");
const clearBtn = document.querySelector("#clearBtn");
const statusText = document.querySelector("#statusText");
const statusPill = document.querySelector("#statusPill");
const modelStatusText = document.querySelector("#modelStatusText");
const statusDot = document.querySelector("#statusDot");
const errorBar = document.querySelector("#errorBar");
const errorTitle = document.querySelector("#errorTitle");
const errorMessage = document.querySelector("#errorMessage");
const dismissErrorBtn = document.querySelector("#dismissErrorBtn");

const systemMessage = {
  role: "system",
  content:
    "You are DakkiAI, a friendly and helpful AI assistant. " +
    "Give clear, useful answers. Keep explanations understandable. " +
    "For coding help, explain the key idea and then provide code when useful. " +
    "Do not claim you can access websites, files, or private information unless the app actually gives you that ability."
};

let engine = null;
let worker = null;
let loading = false;
let generating = false;
let messages = loadSavedMessages();

function loadSavedMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    );
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function saveMessages() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.warn("Could not save chat history:", error);
  }
}

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function setStatus(text, state = "idle") {
  statusText.textContent = text;
  modelStatusText.textContent =
    state === "ready" ? "Ready" :
    state === "loading" ? "Loading model…" :
    state === "error" ? "Load failed" :
    "Not loaded";

  statusDot.className = "status-dot " + state;
  statusPill.className = "status-pill " + state;
}

function setLoadingUI(isLoading) {
  loading = isLoading;
  loadBtn.disabled = isLoading || !!engine;
  if (engine) {
    loadBtnText.textContent = "AI Ready";
  } else if (isLoading) {
    loadBtnText.textContent = "Loading…";
  } else {
    loadBtnText.textContent = "Load AI";
  }
  updateSendState();
}

function updateSendState() {
  sendBtn.disabled = loading || generating || !input.value.trim() || !engine;
}

function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorBar.hidden = false;
  setStatus("Could not start AI", "error");
}

function hideError() {
  errorBar.hidden = true;
}

function addMessage(role, content, save = true) {
  welcome.hidden = true;

  const wrapper = document.createElement("article");
  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "AI";

  const contentWrap = document.createElement("div");
  contentWrap.className = "message-content";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? "You" : "DakkiAI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;

  contentWrap.append(name, bubble);
  wrapper.append(avatar, contentWrap);
  chat.appendChild(wrapper);
  scrollToBottom();

  if (save) {
    messages.push({ role, content });
    saveMessages();
  }

  return bubble;
}

function restoreMessages() {
  for (const message of messages) {
    addMessage(message.role, message.content, false);
  }
  if (messages.length) welcome.hidden = true;
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
}

function createWorker() {
  return new Worker("./worker.js", { type: "module" });
}

async function loadAI() {
  if (engine || loading) return engine;

  hideError();

  if (!("gpu" in navigator)) {
    showError(
      "WebGPU is not available",
      "Open DakkiAI in an up-to-date Chrome or Edge browser on a device that supports WebGPU."
    );
    loadBtn.disabled = true;
    loadBtnText.textContent = "WebGPU needed";
    return null;
  }

  setLoadingUI(true);
  setStatus("Starting browser AI…", "loading");

  try {
    worker = createWorker();

    const { CreateWebWorkerMLCEngine } = await import(
      "https://esm.run/@mlc-ai/web-llm@0.2.85"
    );

    let lastProgressText = "";
    const initProgressCallback = (report) => {
      const text = report?.text || "Loading model…";
      if (text !== lastProgressText) {
        lastProgressText = text;
        setStatus(text, "loading");
      }
      const percent =
        typeof report?.progress === "number"
          ? Math.round(report.progress * 100)
          : null;
      loadBtnText.textContent = percent !== null ? `${percent}%` : "Loading…";
    };

    engine = await CreateWebWorkerMLCEngine(
      worker,
      MODEL_ID,
      {
        initProgressCallback,
        logLevel: "WARN"
      }
    );

    setStatus("AI model ready", "ready");
    setLoadingUI(false);
    updateSendState();
    input.focus();
    return engine;
  } catch (error) {
    console.error(error);
    engine = null;

    try {
      worker?.terminate();
    } catch {}

    worker = null;
    setLoadingUI(false);

    const raw = error?.message || String(error);
    const friendly =
      raw.includes("shader-f16")
        ? "This model needs GPU features your current device may not support."
        : raw.includes("GPU") || raw.includes("WebGPU")
        ? "Your browser detected WebGPU, but the GPU could not initialize the model."
        : "The model could not be loaded. Check the browser console for the exact error.";

    showError("AI model failed to load", friendly);
    loadBtnText.textContent = "Try again";
    updateSendState();
    return null;
  }
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || generating) return;

  hideError();

  if (!engine) {
    const loaded = await loadAI();
    if (!loaded) return;
  }

  generating = true;
  updateSendState();

  addMessage("user", trimmed);
  input.value = "";
  resizeInput();

  const assistantBubble = addMessage("assistant", "Thinking…", false);
  assistantBubble.classList.add("typing");

  const recentMessages = messages.slice(-16);
  const apiMessages = [systemMessage, ...recentMessages];

  try {
    const stream = await engine.chat.completions.create({
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 420,
      stream: true
    });

    let answer = "";

    for await (const chunk of stream) {
      const piece = chunk?.choices?.[0]?.delta?.content || "";
      if (!piece) continue;
      answer += piece;
      assistantBubble.textContent = answer;
      scrollToBottom();
    }

    const finalAnswer = answer.trim() || "I wasn't able to generate a response.";
    assistantBubble.textContent = finalAnswer;
    assistantBubble.classList.remove("typing");

    messages.push({ role: "assistant", content: finalAnswer });
    saveMessages();
    setStatus("AI model ready", "ready");
  } catch (error) {
    console.error(error);
    assistantBubble.classList.remove("typing");
    assistantBubble.textContent = "I couldn't generate a response.";
    showError(
      "Generation failed",
      error?.message || "The model stopped before it finished. Try sending the message again."
    );
  } finally {
    generating = false;
    updateSendState();
    input.focus();
  }
}

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage(input.value);
});

input.addEventListener("input", () => {
  resizeInput();
  updateSendState();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!sendBtn.disabled) composer.requestSubmit();
  }
});

loadBtn.addEventListener("click", loadAI);

document.querySelectorAll(".prompt-card").forEach((card) => {
  card.addEventListener("click", () => {
    input.value = card.dataset.prompt || "";
    resizeInput();
    input.focus();
    updateSendState();
  });
});

newChatBtn.addEventListener("click", () => {
  messages = [];
  saveMessages();
  chat.innerHTML = "";
  chat.appendChild(welcome);
  welcome.hidden = false;
  input.value = "";
  resizeInput();
  updateSendState();
  hideError();
  input.focus();
});

clearBtn.addEventListener("click", () => {
  messages = [];
  saveMessages();
  chat.innerHTML = "";
  chat.appendChild(welcome);
  welcome.hidden = false;
  hideError();
  input.value = "";
  resizeInput();
  updateSendState();
  input.focus();
});

dismissErrorBtn.addEventListener("click", hideError);

window.addEventListener("beforeunload", () => {
  try {
    worker?.terminate();
  } catch {}
});

restoreMessages();
resizeInput();
setStatus("Ready to start");
updateSendState();
