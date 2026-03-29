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

Your job is to convert a brain dump into a structured weekly plan.

CRITICAL RULES:

TASK RULES:
- Extract ALL tasks from the input and assign them to appropriate days
- "work 9-5 monday through friday" = add "work 9-5" to Monday–Friday
- "gym 3 times" = schedule gym on 3 separate days (spread out)
- "dentist wednesday morning" = place on Wednesday
- "dinner with friends friday night" = place on Friday
- NEVER leave weekdays empty if work is mentioned
- NEVER drop tasks

MEAL RULES:
- Only include meals if user mentions food, groceries, cooking, or preferences
- Each day with meals must have 2–3 meals
- If a day includes "dinner with friends" → include that as a meal
- Meals should be realistic and varied
- Avoid repeating the same meals too often
- Respect food dislikes STRICTLY (e.g. no chicken)
- If cooking is mentioned → include home-cooked meals

LOGIC RULES:
- Work days = busy
- Gym days = busy
- If a day has ANY tasks → it should not be empty
- Weekends should include light structure (meals or simple activity)
- Avoid completely empty days unless explicitly requested

OUTPUT FORMAT (STRICT JSON ONLY):

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
