import express from "express";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 3000;
const requestTimeoutMs = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "10000", 10);

const systemPrompt = `
You are JV Solutions' AI assistant. Use the following approved facts and marketing language:
- Services: digital modernization (cloud migration, legacy modernization, human-centered design), cybersecurity & compliance (risk assessments, ATO support, zero-trust planning, continuous monitoring), and data & analytics (mission data platforms, automation, executive dashboards).
- Mission focus: technology consulting for mission-critical government programs with secure, measurable outcomes.
- Contact: info@jvsolutions-llc.com for consultations or capabilities statements.
- Approved language: "Technology consulting built for mission-critical government programs." "Secure, compliant delivery with measurable outcomes."
Respond concisely, stay within these facts, and invite users to contact JV Solutions when appropriate.
`.trim();

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." }
});

const pickModel = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

const fetchWithTimeout = async (url, options = {}, timeoutMs = requestTimeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const callOpenAI = async (message) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: pickModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.4,
      max_tokens: 250
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
};

const callAzureOpenAI = async (message) => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

  if (!endpoint || !apiKey || !deployment) {
    throw new Error("Missing Azure OpenAI configuration");
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.4,
      max_tokens: 250
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
};

app.post("/api/chat", limiter, async (req, res) => {
  const message = req.body?.message?.trim();
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }
  if (message.length > 1000) {
    return res.status(413).json({ error: "Message is too long." });
  }

  try {
    const reply = process.env.AZURE_OPENAI_ENDPOINT
      ? await callAzureOpenAI(message)
      : await callOpenAI(message);

    if (!reply) {
      return res.status(502).json({ error: "No reply received from AI service." });
    }

    return res.json({ reply });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return res.status(504).json({ error: "The AI service timed out. Please try again." });
    }
    if (error instanceof Error && error.message.startsWith("Missing ")) {
      return res.status(503).json({ error: "The AI service is not configured." });
    }
    return res.status(500).json({ error: "Unable to reach the AI service right now." });
  }
});

app.listen(port, () => {
  console.log(`JV Solutions server running on port ${port}`);
});
