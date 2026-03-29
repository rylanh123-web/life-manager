const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Missing API key" });
  }

  try {
    const { brainDump } = req.body;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that turns a messy weekly brain dump into a structured weekly plan."
          },
          {
            role: "user",
            content: brainDump
          }
        ]
      })
    });

    const data = await response.json();

    const output = data.choices?.[0]?.message?.content || "No response";

    res.status(200).json({ plan: output });

  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
}
