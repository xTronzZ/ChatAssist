// src/contentScript.js

console.log("👀 ChatAssist content script injected on", window.location.href);

// --- Helper: extract visible chat messages ---
function getChatMessages() {
  const messages = [];
  document.querySelectorAll("div.selectable-text span").forEach((el) => {
    const text = el.innerText.trim();
    if (text) messages.push(text);
  });
  return messages.slice(-200); // last 200 messages
}

// --- Helper: send messages to background ---
function sendToBackground(history, draft) {
  chrome.runtime.sendMessage(
    {
      type: "AI_REQUEST",
      payload: {
        mode: "single",
        lang: "auto",
        userDraft: draft || "",
        messages: history,
        prompt: "Be friendly but concise."
      }
    },
    (response) => {
      console.log("📬 Got response from background:", response);
      if (response?.rewrite) showSuggestionBox(response.rewrite);
    }
  );
}

// --- Floating suggestion box ---
let suggestionBox;
function showSuggestionBox(text) {
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.style.position = "absolute";
    suggestionBox.style.background = "#fff";
    suggestionBox.style.border = "1px solid #888";
    suggestionBox.style.borderRadius = "8px";
    suggestionBox.style.padding = "8px";
    suggestionBox.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    suggestionBox.style.zIndex = 9999;
    suggestionBox.style.maxWidth = "300px";
    suggestionBox.style.fontSize = "14px";
    document.body.appendChild(suggestionBox);
  }
  suggestionBox.innerText = text;

  const inputBox = document.querySelector('[contenteditable="true"][data-tab="10"]');
  if (inputBox) {
    const rect = inputBox.getBoundingClientRect();
    suggestionBox.style.left = rect.left + "px";
    suggestionBox.style.top = rect.top - 40 + "px";
  }
}

// --- Helper: wait for #main with retries ---
async function waitForChatContainer(retries = 40, interval = 500) {
  for (let i = 0; i < retries; i++) {
    const container = document.querySelector("#main");
    if (container) return container;
    await new Promise((res) => setTimeout(res, interval));
  }
  throw "Could not find WhatsApp chat container (#main)";
}

// --- Main logic ---
(async function initChatAssist() {
  try {
    const chatContainer = await waitForChatContainer();
    console.log("✅ ChatAssist detected chat container:", chatContainer);

    // Observe new messages (optional)
    const observer = new MutationObserver(() => {
      const history = getChatMessages();
      console.log("💬 Captured messages:", history.slice(-5)); // show last 5
    });
    observer.observe(chatContainer, { childList: true, subtree: true });

    // --- Periodically check draft and send to background ---
    setInterval(() => {
      const history = getChatMessages();
      const inputBox = document.querySelector("div._2_1wd.copyable-text.selectable-text");
      const draft = inputBox ? inputBox.innerText.trim() : "";
      if (draft) {
        console.log("⏱ Sending draft to background:", draft);
        sendToBackground(history, draft);
      }
    }, 5000); // every 5 seconds

  } catch (err) {
    console.warn("⚠️ ChatAssist failed to initialize:", err);
  }
})();
