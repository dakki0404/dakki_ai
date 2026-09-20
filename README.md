# DakkiAI

A static browser AI assistant built with HTML, CSS, JavaScript, WebLLM, and WebGPU.

## Files

- `index.html` — page structure
- `style.css` — full UI
- `app.js` — chat logic, storage, WebLLM setup
- `worker.js` — WebLLM worker
- `README.md` — setup notes

## GitHub Pages

1. Create a GitHub repository.
2. Upload all five files to the repository root.
3. Go to **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Choose your `main` branch and the `/ (root)` folder.
6. Open the Pages URL GitHub gives you.

## Important

DakkiAI uses WebLLM to run the model in the browser with WebGPU. The model has to be downloaded the first time it is used, and later visits can reuse browser caching. WebLLM documents both CDN imports and Web Worker support for keeping heavy model work away from the main UI thread.

The default model is:

`Llama-3.2-1B-Instruct-q4f16_1-MLC`

A browser/device with working WebGPU support is required.

## Why this version is different

- Uses a Web Worker for the heavy WebLLM workload.
- Pins WebLLM to `0.2.85` instead of relying on a changing package version.
- Checks WebGPU before trying to load.
- Shows model progress in the UI.
- Handles broken/corrupt local chat history safely.
- Keeps only recent conversation turns in the model context to reduce unnecessary work.
- Uses a more polished responsive layout.
