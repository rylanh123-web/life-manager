export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { brainDump } = req.body;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are an AI life planner.

Convert the user's input into a structured weekly plan in JSON format.

Rules:
- Return ONLY valid JSON
- No explanations, no markdown
- Format exactly like this:

{
  "monday": { "tasks": [], "meals": [], "busy": false },
  "tuesday": { "tasks": [], "meals": [], "busy": false },
  "wednesday": { "tasks": [], "meals": [], "busy": false },
  "thursday": { "tasks": [], "meals": [], "busy": false },
  "friday": { "tasks": [], "meals": [], "busy": false },
  "saturday": { "tasks": [], "meals": [], "busy": false },
  "sunday": { "tasks": [], "meals": [], "busy": false },
  "groceryList": []
}

Guidelines:
- Max 2–3 tasks per day
- Keep it realistic
- Meals must be actual food
- Keep weekend lighter
- Deduplicate grocery list
`
          },
          {
            role: "user",
            content: brainDump
          }
        ]
      })
    });

    const data = await response.json();

    const result = data.choices?.[0]?.message?.content;

    return res.status(200).json({
      plan: result || "No response from AI"
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
