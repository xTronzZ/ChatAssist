// Background service worker
console.log("✅ ChatAssist service worker loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 ChatAssist installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📩 Received message in background:", message);

  if (message.type === "AI_REQUEST") {
    fetch("http://localhost:3001/ai/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(res => res.json())
      .then(data => {
        console.log("✅ Response from AI server:", data);
        sendResponse(data);
      })
      .catch(err => {
        console.error("❌ Fetch error:", err);
        sendResponse({ error: err.toString() });
      });

    return true; // keep channel open
  }
});

// Diagnostic: listen for tab updates and attempt to inject content script on WhatsApp pages
chrome.tabs && chrome.tabs.onUpdated && chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (!tab || !tab.url) return;
    // Log page loads
    if (changeInfo.status === 'complete') {
      console.log('🔎 Tab updated:', tabId, tab.url);
    }

    // If this is a WhatsApp web page, try programmatic injection as a fallback
    if (tab.url && tab.url.includes('web.whatsapp.com') && changeInfo.status === 'complete') {
      console.log('📥 Attempting to inject content script into', tab.url);
      try {
        // Use scripting.executeScript where available (Manifest V3)
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['src/contentScript.js']
          }, (results) => {
            if (chrome.runtime.lastError) {
              console.warn('⚠️ scripting.executeScript error:', chrome.runtime.lastError && chrome.runtime.lastError.message);
            } else {
              console.log('✅ scripting.executeScript result:', results);
            }
          });
        } else {
          // Fallback for older hosts
          chrome.tabs.executeScript && chrome.tabs.executeScript(tabId, { file: 'src/contentScript.js' }, () => {
            if (chrome.runtime.lastError) console.warn('⚠️ tabs.executeScript error:', chrome.runtime.lastError.message);
            else console.log('✅ tabs.executeScript injected content script');
          });
        }
      } catch (e) {
        console.error('❌ Failed to inject content script programmatically', e);
      }
    }
  } catch (e) {
    console.error('Error in tabs.onUpdated handler', e);
  }
});

// Log tab activation (when user switches tabs)
chrome.tabs && chrome.tabs.onActivated && chrome.tabs.onActivated.addListener(activeInfo => {
  try {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      console.log('🔁 Tab activated:', activeInfo.tabId, tab && tab.url);
    });
  } catch (e) {
    console.error('Error in tabs.onActivated handler', e);
  }
});
