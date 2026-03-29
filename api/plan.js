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

CORE RULES:

1. Respect explicit requests:
- If the user says "gym 3 times", schedule EXACTLY 3 sessions
- If the user gives a number, treat it as a requirement, not a suggestion

2. Do NOT invent unnecessary structure:
- Do not create tasks the user didn’t ask for
- Do not fill every day just to make it look complete
- Leave days light if nothing is specified

3. Meals should be OPTIONAL:
- Only include meals if it makes sense
- Do NOT force breakfast/lunch/dinner every day
- If included, use real foods (eggs, chicken, pasta, etc.)

4. Grocery list:
- Only include items if meals are generated
- Use real ingredients
- No duplicates
- No generic items like "breakfast"

5. Scheduling logic:
- Spread things like gym across the week
- Work days = busy
- Weekends = lighter unless specified

6. When the user gives general goals (like "gym 3 times" or "need groceries"):
- You SHOULD expand these into a reasonable plan
- Distribute them across the week logically
- Do not ignore them just because no specific day was given

IMPORTANT:
- It is better to be minimal and accurate than full and incorrect
- Respect missing information (do not assume)

Return ONLY valid JSON in this format:

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
