const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

function safeArray(v) {
  return Array.isArray(v) ? v.filter(Boolean).map(String) : [];
}

function cleanDay(day) {
  return {
    tasks: safeArray(day?.tasks),
    meals: safeArray(day?.meals),
    busy: !!day?.busy
  };
}

function normalizePlan(plan) {
  return {
    monday: cleanDay(plan?.monday),
    tuesday: cleanDay(plan?.tuesday),
    wednesday: cleanDay(plan?.wednesday),
    thursday: cleanDay(plan?.thursday),
    friday: cleanDay(plan?.friday),
    saturday: cleanDay(plan?.saturday),
    sunday: cleanDay(plan?.sunday),
    groceryList: {
      produce: safeArray(plan?.groceryList?.produce),
      protein: safeArray(plan?.groceryList?.protein),
      dairy: safeArray(plan?.groceryList?.dairy),
      pantry: safeArray(plan?.groceryList?.pantry),
      frozen: safeArray(plan?.groceryList?.frozen),
      other: safeArray(plan?.groceryList?.other)
    }
  };
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {}
    }
  }
  return null;
}

async function callAI(messages) {
  const res = await fetch(OPENROUTER_URL, {
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

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`);
  }

  const data = await res.json();
  const parsed = extractJson(data?.choices?.[0]?.message?.content || "");

  if (!parsed) {
    throw new Error("Bad AI JSON");
  }

  return parsed;
}

function buildGenerate(brainDump) {
  return [
    {
      role: "system",
      content: `
Return ONLY valid JSON:
{
  "monday":{"tasks":[],"meals":[],"busy":false},
  "tuesday":{"tasks":[],"meals":[],"busy":false},
  "wednesday":{"tasks":[],"meals":[],"busy":false},
  "thursday":{"tasks":[],"meals":[],"busy":false},
  "friday":{"tasks":[],"meals":[],"busy":false},
  "saturday":{"tasks":[],"meals":[],"busy":false},
  "sunday":{"tasks":[],"meals":[],"busy":false},
  "groceryList":{"produce":[],"protein":[],"dairy":[],"pantry":[],"frozen":[],"other":[]}
}

Rules:
- Turn the brain dump into a realistic weekly plan
- Spread tasks across the week
- Busy days should have lighter workloads
- Meals should be practical and realistic
- Grocery list must match the meals
- Keep wording concise
      `.trim()
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}`
    }
  ];
}

function buildEdit(brainDump, existingPlan, editInstruction) {
  return [
    {
      role: "system",
      content: `
Return ONLY valid JSON in the exact same weekly-plan shape.

Rules:
- Only apply the requested edit
- Keep everything else as intact as possible
- Grocery list must stay aligned with meals
      `.trim()
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}\n\nCurrent plan:\n${JSON.stringify(existingPlan)}\n\nEdit:\n${editInstruction}`
    }
  ];
}

function buildMealDetails(mealName, dayName, existingPlan) {
  return [
    {
      role: "system",
      content: `
Return ONLY valid JSON:
{"title":"","description":"","prepTime":"","ingredients":[],"steps":[]}

Rules:
- Practical, concise meal details
- 3-5 simple steps
- Realistic prep time
      `.trim()
    },
    {
      role: "user",
      content: `Day: ${dayName}\nMeal: ${mealName}\nPlan:\n${JSON.stringify(existingPlan)}`
    }
  ];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
  }

  try {
    const { mode, brainDump, existingPlan, editInstruction, mealName, dayName } = req.body || {};

    if (!brainDump || !String(brainDump).trim()) {
      return res.status(400).json({ error: "brainDump required" });
    }

    if (mode === "generate") {
      const data = await callAI(buildGenerate(String(brainDump).trim()));
      return res.status(200).json(normalizePlan(data));
    }

    if (mode === "quickEdit") {
      if (!existingPlan) {
        return res.status(400).json({ error: "existingPlan required" });
      }
      if (!editInstruction || !String(editInstruction).trim()) {
        return res.status(400).json({ error: "editInstruction required" });
      }

      const data = await callAI(
        buildEdit(String(brainDump).trim(), normalizePlan(existingPlan), String(editInstruction).trim())
      );

      return res.status(200).json(normalizePlan(data));
    }

    if (mode === "mealDetails") {
      if (!existingPlan) {
        return res.status(400).json({ error: "existingPlan required" });
      }
      if (!mealName || !dayName) {
        return res.status(400).json({ error: "mealName and dayName required" });
      }

      const details = await callAI(
        buildMealDetails(String(mealName).trim(), String(dayName).trim(), normalizePlan(existingPlan))
      );

      return res.status(200).json(details);
    }

    return res.status(400).json({ error: "Unsupported mode" });
  } catch (error) {
    console.error("Plan API error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate plan" });
  }
}
