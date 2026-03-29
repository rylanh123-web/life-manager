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
- If the user input is minimal (e.g. "work monday"), DO NOT invent extra tasks
- If the user specifies a quantity (e.g. "gym 3 times"), you MUST match that exact number
- Do NOT fill empty days with fake tasks
- Spread repeated activities (like gym) across the week naturally
- Work days = busy
- Weekends = lighter unless specified

MEAL RULES:
- Meal planning should usually be included as part of a weekly plan, even if the user only edits their schedule
- Do NOT leave meals blank just because the user changed or updated schedule details
- Only leave meals empty if the user clearly does not want meal planning
- Meals should be simple, realistic, and helpful
- Use real foods, not generic labels like "breakfast", "lunch", "dinner"

GROCERY RULES:
- Include a grocery list when meals are included
- Grocery list should contain real ingredients
- No duplicates
- No generic items like "breakfast"

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
