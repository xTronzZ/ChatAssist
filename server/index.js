import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

app.post("/ai/suggest", async (req, res) => {
  const { prompt, messages, lang, mode, userDraft } = req.body;
  // If using Google provider, require GOOGLE_API_KEY; otherwise require OPENAI_API_KEY
  const provider = req.body.provider || process.env.DEFAULT_PROVIDER || 'openai';
  if (provider === 'google' && !process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'Missing GOOGLE_API_KEY for provider=google' });
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
  }

  // Basic input validation
  if (!prompt && (!messages || !Array.isArray(messages))) {
    return res.status(400).json({ error: "Missing prompt or messages" });
  }

  // Build conversation for OpenAI: prefer messages if provided, else use prompt
  const conversation = (messages && Array.isArray(messages) && messages.length)
    ? messages.map(m => ({ role: 'user', content: String(m) }))
    : [{ role: 'user', content: String(prompt) }];

  // Optionally include user's draft as system instruction
  if (userDraft) {
    conversation.unshift({ role: 'system', content: `User draft: ${userDraft}` });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    let data = null;
    if (provider === 'google') {
      // Use Google Generative API (text generation) via API key. Model and URL are configurable via env.
      const model = process.env.GOOGLE_MODEL || 'gemini-nano';
      const baseUrl = process.env.GOOGLE_API_URL || `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generateText`;
      const googleUrl = `${baseUrl}?key=${process.env.GOOGLE_API_KEY}`;

      const promptText = conversation.map(c => c.content).join('\n\n');
      const body = {
        prompt: { text: promptText },
        temperature: 0.7,
        max_output_tokens: 512
      };

      const resp = await fetch(googleUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        return res.status(resp.status).json({ error: 'Google API error', detail: txt });
      }
      data = await resp.json();
      // Try multiple plausible fields for Google Generative responses
      let assistant = null;
      try {
        if (typeof data.output_text === 'string' && data.output_text.trim()) {
          assistant = data.output_text;
        } else if (data.candidates && Array.isArray(data.candidates) && data.candidates.length) {
          const c0 = data.candidates[0];
          if (typeof c0.output_text === 'string' && c0.output_text.trim()) assistant = c0.output_text;
          else if (typeof c0.output === 'string' && c0.output.trim()) assistant = c0.output;
          else if (typeof c0.content === 'string' && c0.content.trim()) assistant = c0.content;
          else if (Array.isArray(c0.content)) {
            assistant = c0.content.map(part => {
              if (!part) return '';
              if (typeof part === 'string') return part;
              if (typeof part.text === 'string') return part.text;
              if (part.output_text && typeof part.output_text === 'string') return part.output_text;
              return '';
            }).join('');
            if (assistant && !assistant.trim()) assistant = null;
          } else if (c0.message && c0.message.content) {
            if (typeof c0.message.content === 'string') assistant = c0.message.content;
            else if (Array.isArray(c0.message.content)) assistant = c0.message.content.map(x => x.text || '').join('');
          }
        }
      } catch (parseErr) {
        console.error('Failed parsing Google response:', parseErr);
      }

      if (!assistant) {
        // Log a truncated debug view to server console for diagnosis (avoid huge dumps)
        try { console.error('Google API returned unexpected response structure:', JSON.stringify(data).slice(0, 4000)); } catch (e) {}
        return res.status(502).json({ error: 'No text found in Google response', raw: data });
      }

      return res.json({ rewrite: assistant, raw: data });
    } else {
      // Default: OpenAI Chat Completions
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: conversation,
          max_tokens: 512,
          temperature: 0.7
        })
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(resp.status).json({ error: 'OpenAI error', detail: txt });
      }

      data = await resp.json();
      const assistant = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content
        : null;

      return res.json({ rewrite: assistant, raw: data });
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'OpenAI request timed out' });
    }
    return res.status(500).json({ error: err.toString() });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Server running on port " + PORT));