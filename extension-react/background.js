import { BACKEND_URL } from './config.js';

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPLOAD_CHUNK_DATA') {
    uploadData(message);
    return false;
  }

  if (message.action === 'FINALIZE_SESSION') {
    finalizeSession(message.data)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'CHECK_STATUS') {
    checkStatus(message.sessionId)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

// When the extension icon is clicked, toggle the widget visibility
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(['nc_visible'], (data) => {
    const isVisible = data.nc_visible !== false; // default true
    chrome.storage.local.set({ nc_visible: !isVisible });
  });
});

/**
 * Uploads merged audio chunks and metadata to the backend.
 */
async function uploadData(message) {
  const { sessionId, chunkIndex, timeline, participants, audio } = message;

  try {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('chunk_index', chunkIndex);
    formData.append('speaker_timeline', timeline);
    formData.append('participants', participants);

    // Audio is a Uint8Array (serialized from content.js)
    // Combined stream containing both tab and microphone audio
    const audioBlob = new Blob([new Uint8Array(Object.values(audio))], { type: 'audio/webm' });
    formData.append('audio', audioBlob, `chunk_${chunkIndex}.webm`);

    const response = await fetch(`${BACKEND_URL}/upload-chunk`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Merged Chunk ${chunkIndex} uploaded successfully:`, result);
  } catch (err) {
    console.error(`❌ Failed to upload chunk ${chunkIndex}:`, err);
  }
}

/**
 * Sends finalization request to the backend.
 */
async function finalizeSession(data) {
  try {
    console.log(`[Background] Triggering /finalize for session:`, data?.session_id);
    const response = await fetch(`${BACKEND_URL}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Background] /finalize failed: ${response.status} ${errorText}`);
      return { ok: false, status: response.status, error: errorText || `HTTP ${response.status}` };
    }

    const result = await response.json();
    console.log(`[Background] ✅ /finalize started:`, result);
    return { ok: true, status: response.status, data: result };
  } catch (err) {
    console.error(`[Background] ❌ /finalize fetch error:`, err);
    return { ok: false, status: 0, error: err.message || 'Network request failed' };
  }
}

/**
 * Checks session processing status on backend.
 */
async function checkStatus(sessionId) {
  try {
    const response = await fetch(`${BACKEND_URL}/status?session_id=${sessionId}`);
    if (!response.ok) {
      return { ok: false, status: response.status, error: 'Status check failed' };
    }
    const result = await response.json();
    return { ok: true, status: response.status, data: result };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}