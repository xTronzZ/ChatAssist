// Background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AI_REQUEST") {
    (async () => {
      const controller = new AbortController();
      const timeoutMs = 15000; // 15 seconds
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch("http://localhost:3001/ai/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.payload),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          sendResponse({ error: `Server returned ${res.status}: ${text}` });
          return;
        }
        const data = await res.json().catch(() => null);
        if (data) sendResponse(data);
        else sendResponse({ error: 'Invalid JSON response from server' });
      } catch (err) {
        clearTimeout(timeout);
        const isAbort = err && err.name === 'AbortError';
        // Log full error for debugging in extension service worker console
        try { console.error('Background fetch error', err); } catch (e) {}
        // Common cause for 'TypeError: Failed to fetch' is network/CORS/firewall
        const hint = isAbort ? 'Timed out' : 'Network/CORS/firewall or server down';
        sendResponse({ error: isAbort ? 'Request timed out' : `Failed to fetch (${hint}): ${err && err.message ? err.message : String(err)}` });
      }
    })();
    return true; // Keep the message channel open for async
  }
});