# Ollama Chat — Standalone HTML + Vanilla JavaScript

A browser-based chat interface for local Ollama models. It uses plain HTML, CSS, and JavaScript. There is no Node.js application, npm installation, bundler, framework, or backend server in this project.

## Features

- Connects to Ollama at `http://127.0.0.1:11434`
- Lists installed models
- Streams model responses as they are generated
- Maintains multiple conversations
- Saves conversation history in browser `localStorage`
- Stop generation
- Adjustable temperature
- Optional system instruction
- Responsive layout

## Files

```text
ollama-chat-standalone/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Run it

1. Install and start Ollama using the official Ollama application.
2. Confirm that a model is installed:

   ```bash
   ollama list
   ```

3. Open `index.html` in a browser, or open the folder with a static editor preview such as VS Code Live Server.

No `npm install`, `npm start`, or Node.js server is needed to run this application.

## Important: browser CORS configuration

Browsers enforce CORS. Ollama must allow the origin from which the HTML page is served.

For local testing with VS Code Live Server, the page commonly uses an origin such as `http://127.0.0.1:5500` or `http://localhost:5500`. Configure Ollama's `OLLAMA_ORIGINS` to allow that origin, then restart Ollama.

For example, on Windows PowerShell, for the current terminal session:

```powershell
$env:OLLAMA_ORIGINS="http://localhost:5500,http://127.0.0.1:5500"
ollama serve
```

If Ollama is already running as a desktop/background application, setting the variable in a separate terminal may not affect that existing process. Set the environment variable for the Ollama application process and restart Ollama.

For a quick local-only test, Ollama supports `OLLAMA_ORIGINS=*`, but this is broader than necessary. Prefer allowing only the local origin you use. Do not expose the Ollama API to untrusted networks.

Opening the page directly as a `file://` URL can produce an opaque browser origin and CORS problems. A static file preview is recommended; it serves the files without adding a Node/npm backend.

## How it works

The browser calls:

- `GET /api/tags` to list local models
- `POST /api/chat` to send messages

Chat requests use Ollama's streaming response format. The app reads newline-delimited JSON chunks from the response stream and appends generated text to the assistant message.

Conversations are saved in the browser's `localStorage`; they remain in that browser profile after refresh, but are not synced to other browsers or devices.

## Privacy and limitations

- Prompts are sent to the Ollama server configured in `app.js` (default: `127.0.0.1`).
- Conversation history is stored locally in browser storage.
- This is a standalone chat application, **not an MCP server**.
- The Google Fonts import in `styles.css` is optional styling; remove the `@import` line for a fully offline visual experience.
- This application does not provide user authentication. Keep Ollama bound to localhost for personal use.

## Change the Ollama address

Edit the first constant in `app.js`:

```javascript
const OLLAMA_URL = "http://127.0.0.1:11434";
```


## Document scanning / chat with files

The chat composer includes an **Attach files** control. Select up to three files and either type a question or send the files without a question to request a summary.

Supported formats:
- Text and source files: `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.html`, `.css`, `.js`, `.ts`, `.py`, `.php`, `.sql`, `.log`, `.yaml`, `.yml`, `.ini`
- PDF: `.pdf` (extracts selectable text using PDF.js)
- Word: `.docx` (extracts text using Mammoth)

Limits: 2 MB per file and 40,000 extracted characters per file. The extracted text is added to the conversation context and saved with the conversation in browser local storage, so later questions in that conversation can refer to the uploaded document. Files are processed in your browser and their extracted text is sent only to the Ollama server configured in `app.js`.

**Important limitations:** this is text extraction, not full OCR. Scanned/image-only PDFs will not yield text. Legacy `.doc` files, Excel workbooks, and images are not supported by this version. PDF.js and Mammoth are loaded from CDNs, so an internet connection is needed to read PDF and DOCX files; plain-text formats work without those libraries.
