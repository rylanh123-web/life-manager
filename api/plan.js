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
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a smart weekly planning assistant.

Turn the user's brain dump into a realistic weekly plan.

STRICT RULES:
- If the user input is minimal (e.g. "work monday"), DO NOT invent extra tasks or meals
- If the user specifies a quantity (e.g. "gym 3 times"), you MUST match that exact number
- Only include meals if the user mentions food, groceries, or meal planning
- Do NOT fill empty days with fake tasks
- Spread repeated activities (like gym) across the week naturally
- Work days = busy
- Weekends = lighter unless specified

Return ONLY JSON:

{
  "monday": { "tasks": [], "meals": [], "busy": true/false },
  "tuesday": { "tasks": [], "meals": [], "busy": true/false },
  "wednesday": { "tasks": [], "meals": [], "busy": true/false },
  "thursday": { "tasks": [], "meals": [], "busy": true/false },
  "friday": { "tasks": [], "meals": [], "busy": true/false },
  "saturday": { "tasks": [], "meals": [], "busy": true/false },
  "sunday": { "tasks": [], "meals": [], "busy": true/false },
  "groceryList": []
}

NO explanation. ONLY JSON.
            `,
          },
          {
            role: "user",
            content: brainDump,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: "Invalid JSON from AI" };
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}
