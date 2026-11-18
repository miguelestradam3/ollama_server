const OLLAMA_URL = "http://127.0.0.1:11434";
const STORAGE_KEY = "ollama-chat-conversations-v1";

const elements = {
  list: document.getElementById("conversation-list"),
  model: document.getElementById("model-select"),
  messages: document.getElementById("messages"),
  welcome: document.getElementById("welcome"),
  form: document.getElementById("chat-form"),
  input: document.getElementById("message-input"),
  send: document.getElementById("send-button"),
  stop: document.getElementById("stop-button"),
  title: document.getElementById("active-title"),
  dot: document.getElementById("connection-dot"),
  connection: document.getElementById("connection-label"),
  toast: document.getElementById("toast"),
  settings: document.getElementById("settings-panel"),
  temperature: document.getElementById("temperature"),
  temperatureValue: document.getElementById("temperature-value"),
  systemPrompt: document.getElementById("system-prompt"),
  fileInput: document.getElementById("file-input"),
  attachButton: document.getElementById("attach-button"),
  selectedFiles: document.getElementById("selected-files")
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 40000;
const MAX_ATTACHED_FILES = 3;
let selectedFiles = [];

let conversations = loadConversations();
let activeConversationId = null;
let abortController = null;

function loadConversations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}
function createId() {
  return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 2800);
}
function setConnection(online, label) {
  elements.dot.className = `status-dot ${online ? "online" : "offline"}`;
  elements.connection.textContent = label;
}
async function api(path, options = {}) {
  const response = await fetch(`${OLLAMA_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Ollama returned HTTP ${response.status}`);
  }
  return response;
}
async function loadModels() {
  elements.model.innerHTML = '<option value="">Loading models…</option>';
  try {
    const response = await api("/api/tags");
    const data = await response.json();
    const models = data.models || [];
    elements.model.innerHTML = "";
    if (!models.length) {
      elements.model.add(new Option("No models installed", ""));
      setConnection(true, "Ollama connected · No models");
      return;
    }
    models.forEach(model => elements.model.add(new Option(model.name, model.name)));
    setConnection(true, `Ollama connected · ${models.length} model${models.length === 1 ? "" : "s"}`);
  } catch (error) {
    elements.model.innerHTML = '<option value="">Ollama unavailable</option>';
    setConnection(false, "Ollama unavailable");
    showToast(`Could not reach Ollama: ${error.message}`);
  }
}
function currentConversation() {
  return conversations.find(item => item.id === activeConversationId);
}
function createConversation() {
  const conversation = {
    id: createId(),
    title: "New conversation",
    model: elements.model.value,
    messages: [],
    createdAt: Date.now()
  };
  conversations.unshift(conversation);
  activeConversationId = conversation.id;
  saveConversations();
  renderAll();
  elements.input.focus();
}
function deleteConversation(id) {
  conversations = conversations.filter(item => item.id !== id);
  if (activeConversationId === id) activeConversationId = conversations[0]?.id || null;
  saveConversations();
  renderAll();
}
function renderConversationList() {
  elements.list.innerHTML = "";
  conversations.forEach(conversation => {
    const row = document.createElement("div");
    row.className = `conversation-item ${conversation.id === activeConversationId ? "active" : ""}`;
    const name = document.createElement("span");
    name.className = "conversation-name";
    name.textContent = conversation.title;
    name.addEventListener("click", () => {
      activeConversationId = conversation.id;
      renderAll();
      document.getElementById("sidebar").classList.remove("open");
    });
    const remove = document.createElement("button");
    remove.className = "delete-conversation";
    remove.type = "button";
    remove.title = "Delete conversation";
    remove.textContent = "×";
    remove.addEventListener("click", event => {
      event.stopPropagation();
      deleteConversation(conversation.id);
    });
    row.append(name, remove);
    elements.list.append(row);
  });
}
function addMessageElement(role, content = "") {
  const wrapper = document.createElement("article");
  wrapper.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "Y" : "O";
  const body = document.createElement("div");
  body.className = "message-body";
  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "user" ? "You" : "Ollama";
  const text = document.createElement("div");
  text.className = "message-content";
  text.textContent = content;
  body.append(label, text);
  wrapper.append(avatar, body);
  elements.messages.append(wrapper);
  return text;
}
function renderMessages() {
  const conversation = currentConversation();
  elements.messages.innerHTML = "";
  elements.welcome.hidden = Boolean(conversation?.messages.length);
  elements.title.textContent = conversation?.title || "New conversation";
  if (conversation) {
    conversation.messages.forEach(message => addMessageElement(message.role, message.displayContent || message.content));
  }
  elements.messages.scrollTop = elements.messages.scrollHeight;
}
function renderAll() {
  renderConversationList();
  renderMessages();
}
function setBusy(busy) {
  elements.send.disabled = busy;
  elements.stop.hidden = !busy;
  elements.send.textContent = busy ? "…" : "↑";
}
function scrollToBottom() {
  const area = document.getElementById("chat-area");
  area.scrollTop = area.scrollHeight;
}
function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSelectedFiles() {
  elements.selectedFiles.innerHTML = "";
  selectedFiles.forEach((file, index) => {
    const chip = document.createElement("span");
    chip.className = "file-chip";
    const name = document.createElement("span");
    name.textContent = `${file.name} · ${formatBytes(file.size)}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `Remove ${file.name}`;
    remove.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderSelectedFiles();
    });
    chip.append(name, remove);
    elements.selectedFiles.append(chip);
  });
  elements.selectedFiles.hidden = selectedFiles.length === 0;
}

async function extractFileText(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} is larger than the 2 MB limit.`);
  }

  let text;
  if (extension === "pdf") {
    if (!window.pdfjsLib) throw new Error("The PDF reader library could not load. Check your internet connection and reload the page.");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(" "));
    }
    text = pages.map((page, index) => `[Page ${index + 1}]\n${page}`).join("\n\n");
  } else if (extension === "docx") {
    if (!window.mammoth) throw new Error("The DOCX reader library could not load. Check your internet connection and reload the page.");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else {
    text = await file.text();
  }

  text = text.replace(/\u0000/g, "").trim();
  if (!text) throw new Error(`${file.name} contains no extractable text. Scanned PDFs need OCR, which is not included yet.`);
  if (text.length > MAX_EXTRACTED_CHARS) {
    text = `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[Document truncated at ${MAX_EXTRACTED_CHARS.toLocaleString()} characters.]`;
  }
  return text;
}

async function prepareUserPrompt(question) {
  if (!selectedFiles.length) return { content: question, displayContent: question };
  if (selectedFiles.length > MAX_ATTACHED_FILES) {
    throw new Error(`Please attach no more than ${MAX_ATTACHED_FILES} files at a time.`);
  }
  const documents = [];
  for (const file of selectedFiles) {
    const extracted = await extractFileText(file);
    documents.push(`===== FILE: ${file.name} =====\n${extracted}\n===== END FILE =====`);
  }
  const instruction = question || "Read the attached document(s). Summarize their contents, identify the main points, and wait for my questions.";
  const content = `${instruction}\n\nPlease use the following attached document content as the source for your answer. If the answer is not present in the documents, say so.\n\n${documents.join("\n\n")}`;
  const displayContent = `${instruction}\n\n📎 ${documents.length} document${documents.length === 1 ? "" : "s"} attached and added to context.`;
  return { content, displayContent };
}

async function streamChat(conversation, userText, displayText = userText) {
  const model = elements.model.value;
  if (!model) throw new Error("Select an installed Ollama model first.");
  conversation.model = model;
  const userMessage = { role: "user", content: userText, displayContent: displayText };
  conversation.messages.push(userMessage);
  if (conversation.messages.filter(item => item.role === "user").length === 1) {
    const titleText = displayText || userText;
    conversation.title = titleText.length > 36 ? `${titleText.slice(0, 36)}…` : titleText;
  }
  saveConversations();
  renderAll();

  const assistantElement = addMessageElement("assistant", "");
  const systemPrompt = elements.systemPrompt.value.trim();
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push(...conversation.messages.map(item => ({ role: item.role, content: item.content })));

  abortController = new AbortController();
  setBusy(true);
  try {
    const response = await api("/api/chat", {
      method: "POST",
      signal: abortController.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature: Number(elements.temperature.value) }
      })
    });

    if (!response.body) throw new Error("This browser does not support streaming responses.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line);
        if (chunk.error) throw new Error(chunk.error);
        const token = chunk.message?.content || "";
        assistantText += token;
        assistantElement.textContent = assistantText;
        scrollToBottom();
      }
    }
    if (buffer.trim()) {
      const chunk = JSON.parse(buffer);
      if (chunk.error) throw new Error(chunk.error);
      assistantText += chunk.message?.content || "";
      assistantElement.textContent = assistantText;
    }
    conversation.messages.push({ role: "assistant", content: assistantText });
    saveConversations();
  } catch (error) {
    if (error.name === "AbortError") {
      assistantElement.textContent += "\n\n[Generation stopped]";
      conversation.messages.push({ role: "assistant", content: assistantElement.textContent });
      saveConversations();
    } else {
      assistantElement.textContent = `Error: ${error.message}`;
      conversation.messages.pop(); // remove the unsaved user message if request failed
      saveConversations();
      showToast(error.message);
    }
  } finally {
    abortController = null;
    setBusy(false);
    renderConversationList();
    elements.title.textContent = conversation.title;
    elements.welcome.hidden = true;
    elements.input.focus();
  }
}

elements.form.addEventListener("submit", async event => {
  event.preventDefault();
  const question = elements.input.value.trim();
  if ((!question && !selectedFiles.length) || abortController) return;
  if (!currentConversation()) createConversation();
  const conversation = currentConversation();
  if (!elements.model.value) {
    showToast("Select an installed Ollama model first.");
    return;
  }
  elements.send.disabled = true;
  try {
    const prepared = await prepareUserPrompt(question);
    selectedFiles = [];
    renderSelectedFiles();
    elements.input.value = "";
    elements.input.style.height = "auto";
    await streamChat(conversation, prepared.content, prepared.displayContent);
  } catch (error) {
    showToast(error.message);
    elements.send.disabled = false;
  }
});
elements.input.addEventListener("input", () => {
  elements.input.style.height = "auto";
  elements.input.style.height = `${Math.min(elements.input.scrollHeight, 180)}px`;
});
elements.input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});
elements.attachButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => {
  const accepted = ["txt", "md", "csv", "json", "xml", "html", "htm", "css", "js", "ts", "py", "php", "sql", "log", "yaml", "yml", "ini", "pdf", "docx"];
  for (const file of Array.from(elements.fileInput.files || [])) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!accepted.includes(extension)) {
      showToast(`Unsupported file type: ${file.name}`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(`${file.name} exceeds the 2 MB file limit.`);
      continue;
    }
    if (!selectedFiles.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
      if (selectedFiles.length >= MAX_ATTACHED_FILES) {
        showToast(`You can attach up to ${MAX_ATTACHED_FILES} files at a time.`);
        break;
      }
      selectedFiles.push(file);
    }
  }
  renderSelectedFiles();
  elements.fileInput.value = "";
});
elements.stop.addEventListener("click", () => abortController?.abort());
document.getElementById("new-chat-button").addEventListener("click", createConversation);
document.getElementById("refresh-models-button").addEventListener("click", loadModels);
document.getElementById("settings-button").addEventListener("click", () => {
  elements.settings.hidden = !elements.settings.hidden;
});
elements.temperature.addEventListener("input", () => {
  elements.temperatureValue.textContent = Number(elements.temperature.value).toFixed(1);
});
document.getElementById("mobile-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});
document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    elements.input.value = button.dataset.prompt;
    elements.input.focus();
  });
});

if (conversations.length) activeConversationId = conversations[0].id;
renderAll();
loadModels();
