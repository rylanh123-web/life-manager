const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const EMPTY_PLAN = {
  monday: { tasks: [], meals: [], busy: false },
  tuesday: { tasks: [], meals: [], busy: false },
  wednesday: { tasks: [], meals: [], busy: false },
  thursday: { tasks: [], meals: [], busy: false },
  friday: { tasks: [], meals: [], busy: false },
  saturday: { tasks: [], meals: [], busy: false },
  sunday: { tasks: [], meals: [], busy: false },
  groceryList: []
};

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function safeDay(day) {
  return {
    tasks: safeArray(day?.tasks),
    meals: safeArray(day?.meals),
    busy: Boolean(day?.busy)
  };
}

function normalizePlan(plan) {
  return {
    monday: safeDay(plan?.monday),
    tuesday: safeDay(plan?.tuesday),
    wednesday: safeDay(plan?.wednesday),
    thursday: safeDay(plan?.thursday),
    friday: safeDay(plan?.friday),
    saturday: safeDay(plan?.saturday),
    sunday: safeDay(plan?.sunday),
    groceryList: safeArray(plan?.groceryList)
  };
}

function extractJson(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

async function callOpenRouter(messages) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content);

  if (!parsed) {
    throw new Error("Invalid JSON from model");
  }

  return parsed;
}

function buildGenerateMessages(brainDump) {
  return [
    {
      role: "system",
      content: `
You are generating a weekly life plan for a real product called Life Manager.

Return ONLY valid JSON in this exact format:
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

Rules:
- Only JSON
- No extra text
- Extract all explicit tasks from the brain dump
- Distribute tasks realistically across the week
- Aim for 2-3 core tasks per day when possible, but do not drop explicit user tasks
- Meals should be practical and realistic
- Respect exact food dislikes and restrictions from the brain dump
- Never leave a broken meal
- If a disliked or restricted ingredient is a core part of a meal, replace the entire meal with a complete alternative
- Grocery list must match meals
- Keep wording concise and human
      `.trim()
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}`
    }
  ];
}

function buildQuickEditMessages(brainDump, existingPlan, editInstruction) {
  return [
    {
      role: "system",
      content: `
You are editing an existing weekly plan.

Return ONLY valid JSON in this exact format:
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

Rules:
- Apply only what the user requested
- Keep everything else the same
- Do not randomly rewrite the whole plan
- Do not drop explicit tasks unless the user clearly asks for that
- Meals must stay realistic
- Respect exact food dislikes and restrictions from the brain dump
- Never leave a broken meal
- If removing a core ingredient from a meal, replace the entire meal with a complete alternative
- Grocery list must match meals
- No extra text
      `.trim()
    },
    {
      role: "user",
      content: `
Brain dump:
${brainDump}

Current plan:
${JSON.stringify(existingPlan, null, 2)}

User request:
${editInstruction}
      `.trim()
    }
  ];
}

function buildMealDetailsMessages(brainDump, existingPlan, mealName, dayName) {
  return [
    {
      role: "system",
      content: `
You are creating a simple meal detail card for Life Manager.

Return ONLY valid JSON in this exact format:
{
  "title": "",
  "description": "",
  "prepTime": "",
  "ingredients": [],
  "steps": []
}

Rules:
- Only JSON
- No extra text
- Description must be one short sentence
- Keep this practical and realistic
- This is not a blog recipe
- Prep time should be short and realistic
- Ingredients should be concise and useful
- Steps should be 3 to 5 simple steps
- Respect exact dislikes and restrictions from the brain dump
- Never output a broken meal
- If the named meal includes a restricted core ingredient, reinterpret it as the nearest complete allowed alternative
- If the meal is eating out or social, still provide useful output:
  - short description
  - minimal ingredients if appropriate
  - simple steps like what to order or how to prep
      `.trim()
    },
    {
      role: "user",
      content: `
Brain dump:
${brainDump}

Current weekly plan:
${JSON.stringify(existingPlan, null, 2)}

Day:
${dayName}

Meal:
${mealName}
      `.trim()
    }
  ];
}

function normalizeMealDetails(details, mealName) {
  return {
    title: typeof details?.title === "string" && details.title.trim() ? details.title.trim() : mealName,
    description: typeof details?.description === "string" ? details.description.trim() : "",
    prepTime: typeof details?.prepTime === "string" ? details.prepTime.trim() : "",
    ingredients: safeArray(details?.ingredients),
    steps: safeArray(details?.steps)
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "Missing OPENROUTER_API_KEY",
      fallback: {
        ...EMPTY_PLAN,
        isFallback: true
      }
    });
  }

  try {
    const {
      mode = "generate",
      brainDump = "",
      existingPlan = null,
      editInstruction = "",
      mealName = "",
      dayName = ""
    } = req.body || {};

    if (!brainDump || typeof brainDump !== "string" || !brainDump.trim()) {
      return res.status(400).json({ error: "brainDump is required" });
    }

    if (mode === "generate") {
      const generated = await callOpenRouter(buildGenerateMessages(brainDump.trim()));

      return res.status(200).json({
        ...normalizePlan(generated),
        isFallback: false
      });
    }

    if (mode === "quickEdit") {
      if (!existingPlan || typeof existingPlan !== "object") {
        return res.status(400).json({ error: "existingPlan is required for quickEdit" });
      }

      if (!editInstruction || typeof editInstruction !== "string" || !editInstruction.trim()) {
        return res.status(400).json({ error: "editInstruction is required for quickEdit" });
      }

      const updated = await callOpenRouter(
        buildQuickEditMessages(brainDump.trim(), normalizePlan(existingPlan), editInstruction.trim())
      );

      return res.status(200).json({
        ...normalizePlan(updated),
        isFallback: false
      });
    }

    if (mode === "mealDetails") {
      if (!existingPlan || typeof existingPlan !== "object") {
        return res.status(400).json({ error: "existingPlan is required for mealDetails" });
      }

      if (!mealName || typeof mealName !== "string" || !mealName.trim()) {
        return res.status(400).json({ error: "mealName is required for mealDetails" });
      }

      if (!dayName || typeof dayName !== "string" || !dayName.trim()) {
        return res.status(400).json({ error: "dayName is required for mealDetails" });
      }

      const details = await callOpenRouter(
        buildMealDetailsMessages(
          brainDump.trim(),
          normalizePlan(existingPlan),
          mealName.trim(),
          dayName.trim()
        )
      );

      return res.status(200).json({
        ...normalizeMealDetails(details, mealName.trim()),
        isFallback: false
      });
    }

    return res.status(400).json({ error: "Unsupported mode" });
  } catch (error) {
    console.error("Plan API error:", error);

    return res.status(500).json({
      error: error.message || "Failed to generate plan",
      fallback: {
        ...EMPTY_PLAN,
        isFallback: true
      }
    });
  }
}
