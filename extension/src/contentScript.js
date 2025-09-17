

// src/contentScript.js

console.log("👀 ChatAssist content script injected on", window.location.href);

// Immediate visual badge and early log to confirm injection as soon as possible
try {
  const earlyId = 'chatassist-early-badge';
  if (!document.getElementById(earlyId)) {
    const eb = document.createElement('div');
    eb.id = earlyId;
    eb.innerText = 'ChatAssist (injected)';
    eb.style.position = 'fixed';
    eb.style.left = '12px';
    eb.style.top = '12px';
    eb.style.background = 'rgba(43,140,255,0.95)';
    eb.style.color = '#fff';
    eb.style.padding = '4px 8px';
    eb.style.borderRadius = '6px';
    eb.style.zIndex = '2147483647';
    eb.style.fontSize = '12px';
    eb.style.pointerEvents = 'none';
    document.documentElement && document.documentElement.appendChild ? document.documentElement.appendChild(eb) : document.body.appendChild(eb);
  }
  console.log('🚩 ChatAssist early badge added');
} catch (e) {
  console.warn('Could not add early badge', e);
}

// --- Helper: extract visible chat messages ---
function getChatMessages() {
  const messages = [];
  // WhatsApp Web messages use the selectable-text class
  document.querySelectorAll("div.selectable-text span").forEach((el) => {
    const text = el.innerText.trim();
    if (text) messages.push(text);
  });
  return messages.slice(-200); // keep last 200 messages
}

// --- Suggestion box with Apply action (inline near input) ---
let _chatassist_suggestionBox = null;
function showSuggestionBox(text) {
  try {
    console.log('showSuggestionBox called');
    // Find input container to attach inline
    const attachSelectors = [
      'div._2_1wd.copyable-text.selectable-text',
      'div._13NKt.copyable-text.selectable-text',
      '[contenteditable="true"][data-tab]'
    ];

    let attachParent = null;
    for (const sel of attachSelectors) {
      const el = document.querySelector(sel);
      if (el && el.parentElement) {
        attachParent = el.parentElement;
        break;
      }
    }

    if (!_chatassist_suggestionBox) {
      const box = document.createElement('div');
      box.id = 'chatassist-suggestion-box';
      box.style.maxWidth = '420px';
      box.style.background = '#fff';
      box.style.border = '1px solid #ccc';
      box.style.borderRadius = '8px';
      box.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
      box.style.padding = '12px';
  // Very high z-index to overcome WhatsApp stacking contexts
  box.style.zIndex = 2147483646;
      box.style.fontSize = '14px';
      box.style.color = '#111';
      box.style.transition = 'transform 160ms ease, opacity 160ms ease';

      const content = document.createElement('div');
      content.id = 'chatassist-suggestion-content';
      content.style.whiteSpace = 'pre-wrap';
      content.style.marginBottom = '8px';

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.justifyContent = 'flex-end';
      actions.style.gap = '8px';

      const applyBtn = document.createElement('button');
      applyBtn.id = 'chatassist-apply-btn';
      applyBtn.innerText = 'Apply';
      applyBtn.style.padding = '6px 10px';
      applyBtn.style.background = '#2b8cff';
      applyBtn.style.color = '#fff';
      applyBtn.style.border = 'none';
      applyBtn.style.borderRadius = '6px';
      applyBtn.style.cursor = 'pointer';

      const closeBtn = document.createElement('button');
      closeBtn.innerText = 'Close';
      closeBtn.style.padding = '6px 10px';
      closeBtn.style.background = '#eee';
      closeBtn.style.color = '#111';
      closeBtn.style.border = 'none';
      closeBtn.style.borderRadius = '6px';
      closeBtn.style.cursor = 'pointer';

      actions.appendChild(closeBtn);
      actions.appendChild(applyBtn);

      box.appendChild(content);
      box.appendChild(actions);

  document.body.appendChild(box); // temporary until we can attach inline
      _chatassist_suggestionBox = box;

  console.log('Created suggestion box node');

      closeBtn.addEventListener('click', () => {
        try { _chatassist_suggestionBox.style.display = 'none'; } catch (e) {}
      });

      applyBtn.addEventListener('click', () => {
        console.log('Apply button clicked in suggestion box');
        // Find input element (contenteditable) and robustly paste text
        const inputSelectors = [
          'div._2_1wd.copyable-text.selectable-text',
          'div._13NKt.copyable-text.selectable-text',
          '[contenteditable="true"][data-tab]'
        ];
        let inputEl = null;
        for (const sel of inputSelectors) {
          const el = document.querySelector(sel);
          if (el) { inputEl = el; break; }
        }
        if (!inputEl) {
          alert('Could not find input to paste into.');
          return;
        }

        const newText = (_chatassist_suggestionBox.querySelector('#chatassist-suggestion-content') || {}).innerText || text || '';

        // Focus and simulate paste with robust events
        inputEl.focus();
        // For contenteditable, use document.execCommand('insertText') where supported
        const succeeded = (() => {
          try {
            // Try execCommand first
            if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
              document.execCommand('insertText', false, newText);
              return true;
            }
          } catch (e) {}
          return false;
        })();

        if (!succeeded) {
          // Fallback: set innerText and dispatch events
          inputEl.innerText = newText;
          // Dispatch selection and keyboard-like events to mimic user typing
          const dispatch = (el, type, props = {}) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
          // input
          dispatch(inputEl, 'input');
          // key events
          ['keydown','keyup','keypress'].forEach(t => dispatch(inputEl, t));
          // Optional: set selection to end
          try {
            const range = document.createRange();
            range.selectNodeContents(inputEl);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (e) {}
        }

        // Show confirmation toast
        showToast('Applied rewrite');

        // Hide suggestion box after applying
        try { _chatassist_suggestionBox.style.display = 'none'; } catch (e) {}
      });
    }

    // update content and show
    const content = _chatassist_suggestionBox.querySelector('#chatassist-suggestion-content');
    if (content) content.innerText = text;

    // Attach inline if possible
    if (attachParent) {
      try {
        // Insert before the parent's next sibling to keep it near input
        attachParent.insertAdjacentElement('afterend', _chatassist_suggestionBox);
        _chatassist_suggestionBox.style.position = 'relative';
        _chatassist_suggestionBox.style.bottom = '';
        _chatassist_suggestionBox.style.right = '';
        _chatassist_suggestionBox.style.marginTop = '8px';
        _chatassist_suggestionBox.style.opacity = '1';
        _chatassist_suggestionBox.style.transform = 'translateY(0)';
      } catch (e) {
        // fallback to floating
        _chatassist_suggestionBox.style.position = 'fixed';
        _chatassist_suggestionBox.style.bottom = '80px';
        _chatassist_suggestionBox.style.right = '20px';
      }
    } else {
      _chatassist_suggestionBox.style.position = 'fixed';
      _chatassist_suggestionBox.style.bottom = '80px';
      _chatassist_suggestionBox.style.right = '20px';
    }

    _chatassist_suggestionBox.style.display = '';
    _chatassist_suggestionBox.style.opacity = '1';
    _chatassist_suggestionBox.style.transform = 'translateY(0)';
  } catch (err) {
    console.error('Failed to show suggestion box', err);
  }
}

// Small toast helper
function showToast(message, timeout = 1800) {
  try {
    const id = 'chatassist-toast';
    let t = document.getElementById(id);
    if (!t) {
      t = document.createElement('div');
      t.id = id;
      t.style.position = 'fixed';
      t.style.bottom = '24px';
      t.style.left = '50%';
      t.style.transform = 'translateX(-50%)';
      t.style.background = 'rgba(0,0,0,0.8)';
      t.style.color = '#fff';
      t.style.padding = '8px 12px';
      t.style.borderRadius = '20px';
      t.style.fontSize = '13px';
  // Very high to ensure visibility
  t.style.zIndex = 2147483646;
      t.style.opacity = '0';
      t.style.transition = 'opacity 180ms ease, transform 180ms ease';
      document.body.appendChild(t);
    }
    t.innerText = message;
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(t._dismissTimer);
    t._dismissTimer = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(8px)';
    }, timeout);
  } catch (e) {
    console.log('toast failed', e);
  }
}

// Top-centered error banner to avoid being hidden by WhatsApp UI
function showError(message, timeout = 4000) {
  try {
    const id = 'chatassist-error-banner';
    let b = document.getElementById(id);
    if (!b) {
      b = document.createElement('div');
      b.id = id;
      b.style.position = 'fixed';
      b.style.top = '72px';
      b.style.left = '50%';
      b.style.transform = 'translateX(-50%)';
      b.style.background = 'rgba(220,53,69,0.95)'; // bootstrap danger-ish
      b.style.color = '#fff';
      b.style.padding = '10px 14px';
      b.style.borderRadius = '8px';
      b.style.fontSize = '13px';
  // ensure it's on top of any WhatsApp overlays
  b.style.zIndex = '2147483647';
      b.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
      b.style.maxWidth = '720px';
      b.style.wordBreak = 'break-word';
      b.style.textAlign = 'center';
      b.style.pointerEvents = 'auto';
      document.body.appendChild(b);
    }
    b.innerText = message;
    b.style.opacity = '1';
    clearTimeout(b._dismissTimer);
    b._dismissTimer = setTimeout(() => {
      try { b.style.opacity = '0'; b.remove(); } catch (e) {}
    }, timeout);
  } catch (e) {
    console.error('showError failed', e);
  }
}

// --- Observe new messages being added to the chat ---
// Robustly wait for the chat container (WhatsApp updates DOM frequently)
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function waitForChatContainer(selectors = ["#main", 'div[role="main"]', 'div[role="region"]', 'div.copyable-area'], timeoutMs = 30000, interval = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    await delay(interval);
  }
  return null;
}

(async function initObserver() {
  const selectors = ["#main", 'div[role="main"]', 'div[role="region"]', 'div.copyable-area'];
  const container = await waitForChatContainer(selectors, 30000, 500);

  if (!container) {
    console.warn('⚠️ Could not find WhatsApp chat container (tried selectors):', selectors);
    return;
  }

  // Debounced observer: coalesce rapid mutations and avoid sending a request on every DOM change.
  let _mutateTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(_mutateTimer);
    _mutateTimer = setTimeout(() => {
      const history = getChatMessages();
      console.log("💬 ChatAssist captured messages (debounced):", history.slice(-5));
      // NOTE: we intentionally do not auto-send on every mutation to avoid spam/rate-limits.
      // If you want automatic behavior, uncomment the send below and consider additional throttling.
      // chrome.runtime.sendMessage({ type: 'AI_REQUEST', payload: { mode: 'single', lang: 'auto', messages: history, prompt: 'Be friendly but concise.' } }, (response) => { console.log('📬 Got response from background (auto):', response); });
    }, 2000);
  });

  observer.observe(container, { childList: true, subtree: true });
  console.log("👂 ChatAssist MutationObserver active on:", container);
})();

// --- Persistent manual rewrite button (inline near input) ---
function createInlineRewriteButton() {
  // Avoid creating multiple buttons
  if (document.getElementById('chatassist-rewrite-btn')) return;
  console.log('createInlineRewriteButton: start');

  const btn = document.createElement('button');
  btn.id = 'chatassist-rewrite-btn';
  btn.type = 'button';
  btn.innerText = 'Rewrite with AI';
  btn.style.padding = '6px 10px';
  btn.style.background = '#2b8cff';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 1px 6px rgba(0,0,0,0.15)';
  btn.style.marginLeft = '8px';

  btn.addEventListener('click', async () => {
    // Find the draft input; WhatsApp input selectors differ, try common ones
    const inputSelectors = [
      'div._2_1wd.copyable-text.selectable-text',
      'div._13NKt.copyable-text.selectable-text',
      '[contenteditable="true"][data-tab]'
    ];
    let draft = '';
    let inputEl = null;
    for (const sel of inputSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        inputEl = el;
        draft = el.innerText || el.textContent || '';
        break;
      }
    }

    if (!draft) {
      console.warn('✳️ No draft found to rewrite');
      // As a fallback, open suggestion box saying nothing found
      showError('No draft found to rewrite.');
      return;
    }

    btn.disabled = true;
    const prevText = btn.innerText;
    btn.innerText = 'Rewriting...';

    chrome.runtime.sendMessage({ type: 'AI_REQUEST', payload: { prompt: `Rewrite: ${draft}`, messages: [], lang: 'auto', mode: 'single', userDraft: draft } }, (response) => {
      btn.disabled = false;
      btn.innerText = prevText;
      if (!response) {
        console.error('No response from background');
        showError('No response from AI server.');
        return;
      }
      if (response.error) {
        console.error('AI error', response.error);
        showError('AI rewrite failed: ' + (response.error.detail || response.error));
        return;
      }
      const rewritten = response.rewrite || (response.raw && response.raw.choices && response.raw.choices[0] && response.raw.choices[0].message && response.raw.choices[0].message.content) || null;
      if (rewritten) {
        // Show suggestion and offer to paste
        showSuggestionBox(rewritten);
        // Optionally paste into input when clicked in suggestion box (not implemented)
      } else {
        console.warn('AI returned no rewrite');
        showError('AI returned no rewrite.');
      }
    });
  });

  // Try to attach next to the input field
  const attachSelectors = [
    'div._2_1wd.copyable-text.selectable-text',
    'div._13NKt.copyable-text.selectable-text',
    '[contenteditable="true"][data-tab]'
  ];
  for (const sel of attachSelectors) {
    const input = document.querySelector(sel);
    if (input && input.parentElement) {
      // Try to insert after the input element
      try {
        input.parentElement.style.display = input.parentElement.style.display || '';
        // Insert as sibling so it stays near input
        input.insertAdjacentElement('afterend', btn);
        console.log('createInlineRewriteButton: attached next to selector', sel);
        return btn;
      } catch (e) {
        console.warn('createInlineRewriteButton: attach attempt failed for', sel, e);
        // fallback continue
      }
    }
  }

  // Final fallback: floating button
  btn.style.position = 'fixed';
  btn.style.zIndex = '2147483646';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  document.body.appendChild(btn);
  console.log('createInlineRewriteButton: appended floating fallback');
  return btn;
}

// Small persistent debug badge so user can see the extension injected
function ensureDebugBadge() {
  try {
    const id = 'chatassist-debug-badge';
    if (document.getElementById(id)) return;
    const b = document.createElement('div');
    b.id = id;
    b.innerText = 'ChatAssist';
    b.title = 'ChatAssist extension is active';
    b.style.position = 'fixed';
    b.style.left = '12px';
    b.style.bottom = '12px';
    b.style.background = '#2b8cff';
    b.style.color = '#fff';
    b.style.padding = '6px 8px';
    b.style.borderRadius = '6px';
    b.style.fontSize = '12px';
    b.style.zIndex = '2147483647';
    b.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    b.style.opacity = '0.92';
    b.style.pointerEvents = 'none';
    document.body.appendChild(b);
  } catch (e) {
    console.error('Failed to add debug badge', e);
  }
}

// Reattach loop: ensure the button exists near the input every 2s for the first minute, then every 10s
function startReattachLoop() {
  let attempts = 0;
  const maxFast = 30; // 30 * 2s = 60s
  const fastInterval = 2000;
  const slowInterval = 10000;

  const ensure = () => {
    try {
      ensureDebugBadge();
      if (!document.getElementById('chatassist-rewrite-btn')) {
        const btn = createInlineRewriteButton();
        if (btn && !document.getElementById('chatassist-rewrite-btn')) {
          try { document.body.appendChild(btn); } catch (e) {}
        }
      }
    } catch (e) {
      // swallow errors
    }
    attempts++;
  };

  // initial fast loop
  const fastTimer = setInterval(() => {
    ensure();
    if (attempts >= maxFast) {
      clearInterval(fastTimer);
      // start slow loop
      setInterval(ensure, slowInterval);
    }
  }, fastInterval);
}

// Start reattach loop
try { ensureDebugBadge(); startReattachLoop(); } catch (e) {}

// --- Draggable floating Rewrite button + mini chatbox ---
function createDraggableRewriteWidget() {
  if (document.getElementById('chatassist-draggable-widget')) return;

  const widget = document.createElement('div');
  widget.id = 'chatassist-draggable-widget';
  widget.style.position = 'fixed';
  const saved = localStorage.getItem('chatassist_widget_pos');
  if (saved) {
    try { const p = JSON.parse(saved); widget.style.left = p.x + 'px'; widget.style.top = p.y + 'px'; } catch(e) { widget.style.right = '20px'; widget.style.bottom = '100px'; }
  } else {
    widget.style.right = '20px';
    widget.style.bottom = '100px';
  }
  widget.style.zIndex = 2147483646;
  widget.style.width = '56px';
  widget.style.height = '56px';
  widget.style.borderRadius = '28px';
  widget.style.background = '#2b8cff';
  widget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2)';
  widget.style.display = 'flex';
  widget.style.alignItems = 'center';
  widget.style.justifyContent = 'center';
  widget.style.cursor = 'grab';

  const icon = document.createElement('div');
  icon.style.color = '#fff';
  icon.style.fontSize = '12px';
  icon.style.fontWeight = '700';
  icon.innerText = 'AI';
  widget.appendChild(icon);

  // Mini chatbox (hidden by default)
  const box = document.createElement('div');
  box.id = 'chatassist-mini-box';
  box.style.position = 'fixed';
  box.style.width = '360px';
  box.style.maxWidth = '90vw';
  box.style.height = '420px';
  box.style.background = '#fff';
  box.style.border = '1px solid #ddd';
  box.style.borderRadius = '10px';
  box.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
  box.style.padding = '10px';
  box.style.display = 'none';
  box.style.zIndex = 2147483647;

  // Header
  const h = document.createElement('div');
  h.style.display = 'flex';
  h.style.justifyContent = 'space-between';
  h.style.alignItems = 'center';
  const title = document.createElement('div'); title.innerText = 'Rewrite with AI'; title.style.fontWeight = '600';
  const closeX = document.createElement('button'); closeX.innerText = '✕'; closeX.style.border = 'none'; closeX.style.background = 'transparent'; closeX.style.cursor = 'pointer';
  closeX.addEventListener('click', () => { box.style.display = 'none'; });
  h.appendChild(title); h.appendChild(closeX);

  // History preview
  const historyEl = document.createElement('div');
  historyEl.style.flex = '1';
  historyEl.style.overflow = 'auto';
  historyEl.style.height = '200px';
  historyEl.style.border = '1px solid #f1f1f1';
  historyEl.style.padding = '8px';
  historyEl.style.marginTop = '8px';
  historyEl.style.whiteSpace = 'pre-wrap';
  historyEl.id = 'chatassist-mini-history';

  // Plan textarea
  const planLabel = document.createElement('div'); planLabel.innerText = 'Your plan (tell the AI overall goal):'; planLabel.style.marginTop = '8px'; planLabel.style.fontSize = '13px';
  const planInput = document.createElement('textarea');
  planInput.id = 'chatassist-mini-plan';
  planInput.style.width = '100%';
  planInput.style.height = '70px';
  planInput.style.marginTop = '6px';
  planInput.style.borderRadius = '6px';
  planInput.style.border = '1px solid #ddd';
  planInput.style.padding = '8px';

  // Send area
  const sendRow = document.createElement('div'); sendRow.style.display = 'flex'; sendRow.style.justifyContent = 'space-between'; sendRow.style.alignItems = 'center'; sendRow.style.gap = '8px';
  const sendBtn = document.createElement('button'); sendBtn.innerText = 'Send to AI'; sendBtn.style.padding = '8px 12px'; sendBtn.style.background = '#2b8cff'; sendBtn.style.color = '#fff'; sendBtn.style.border = 'none'; sendBtn.style.borderRadius = '6px'; sendBtn.style.cursor = 'pointer';
  const status = document.createElement('div'); status.id = 'chatassist-mini-status'; status.style.fontSize = '12px'; status.style.color = '#666';
  sendRow.appendChild(status); sendRow.appendChild(sendBtn);

  // Response area
  const responseEl = document.createElement('div'); responseEl.id = 'chatassist-mini-response'; responseEl.style.marginTop = '8px'; responseEl.style.whiteSpace = 'pre-wrap'; responseEl.style.maxHeight = '90px'; responseEl.style.overflow = 'auto'; responseEl.style.borderTop = '1px dashed #eee'; responseEl.style.paddingTop = '8px';

  box.appendChild(h);
  box.appendChild(historyEl);
  box.appendChild(planLabel);
  box.appendChild(planInput);
  box.appendChild(sendRow);
  box.appendChild(responseEl);

  document.body.appendChild(widget);
  document.body.appendChild(box);

  // Position the mini box relative to widget
  function positionBox() {
    const rect = widget.getBoundingClientRect();
    box.style.left = Math.max(8, rect.left - 320) + 'px';
    box.style.top = Math.max(8, rect.top - 8) + 'px';
  }

  // Toggle on click
    widget.addEventListener('click', (e) => {
    if (box.style.display === 'none') {
      // preload history
      const msgs = getChatMessages();
      historyEl.innerText = msgs.join('\n\n');
      responseEl.innerText = '';
      status.innerText = '';
      // Load last plan from localStorage
      try { const last = localStorage.getItem('chatassist_last_plan'); if (last) planInput.value = last; } catch(e){}
      box.style.display = 'block';
      positionBox();
    } else box.style.display = 'none';
  });

  // Debounced autosave for plan
  let _saveTimer = null;
  planInput.addEventListener('input', () => {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try { localStorage.setItem('chatassist_last_plan', planInput.value || ''); } catch (e) {}
    }, 350);
  });

  // Send handler
  sendBtn.addEventListener('click', () => {
    const plan = planInput.value || '';
    try { localStorage.setItem('chatassist_last_plan', plan); } catch(e){}
    const msgs = getChatMessages();
    status.innerText = 'Sending...';
    sendBtn.disabled = true;
    chrome.runtime.sendMessage({ type: 'AI_REQUEST', payload: { provider: 'google', prompt: plan, messages: msgs, userDraft: '', mode: 'overall' } }, (response) => {
      sendBtn.disabled = false;
      if (!response) { status.innerText = 'No response'; showError('No response from AI server'); return; }
      if (response.error) { status.innerText = 'Error'; showError('AI error: ' + (response.error.detail || response.error)); return; }
      const text = response.rewrite || (response.raw && response.raw.output_text) || JSON.stringify(response.raw).slice(0, 2000);
      responseEl.innerText = text || 'No reply';
      status.innerText = 'Done';
    });
  });

  // Draggable behavior
  let dragging = false, offsetX = 0, offsetY = 0;
  widget.addEventListener('mousedown', (e) => { dragging = true; widget.style.cursor = 'grabbing'; offsetX = e.clientX - widget.getBoundingClientRect().left; offsetY = e.clientY - widget.getBoundingClientRect().top; e.preventDefault(); });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    widget.style.left = (e.clientX - offsetX) + 'px';
    widget.style.top = (e.clientY - offsetY) + 'px';
    widget.style.right = '';
    widget.style.bottom = '';
    positionBox();
  });
  document.addEventListener('mouseup', () => { if (!dragging) return; dragging = false; widget.style.cursor = 'grab'; try { localStorage.setItem('chatassist_widget_pos', JSON.stringify({ x: parseInt(widget.style.left,10), y: parseInt(widget.style.top,10) })); } catch(e){} });
}

createDraggableRewriteWidget();

// Initial test ping removed to avoid spamming the background server during startup.
