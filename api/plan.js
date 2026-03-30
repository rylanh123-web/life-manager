const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const EMPTY_GROCERY_GROUPS = {
  produce: [],
  protein: [],
  dairy: [],
  pantry: [],
  frozen: [],
  other: []
};

const EMPTY_PLAN = {
  monday: { tasks: [], meals: [], busy: false },
  tuesday: { tasks: [], meals: [], busy: false },
  wednesday: { tasks: [], meals: [], busy: false },
  thursday: { tasks: [], meals: [], busy: false },
  friday: { tasks: [], meals: [], busy: false },
  saturday: { tasks: [], meals: [], busy: false },
  sunday: { tasks: [], meals: [], busy: false },
  groceryList: EMPTY_GROCERY_GROUPS
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

function normalizeGroceryList(groceryList) {
  if (Array.isArray(groceryList)) {
    return {
      produce: [],
      protein: [],
      dairy: [],
      pantry: safeArray(groceryList),
      frozen: [],
      other: []
    };
  }

  return {
    produce: safeArray(groceryList?.produce),
    protein: safeArray(groceryList?.protein),
    dairy: safeArray(groceryList?.dairy),
    pantry: safeArray(groceryList?.pantry),
    frozen: safeArray(groceryList?.frozen),
    other: safeArray(groceryList?.other)
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
    groceryList: normalizeGroceryList(plan?.groceryList)
  };
}

function normalizePreferences(preferences) {
  return {
    dislikedIngredients: safeArray(preferences?.dislikedIngredients),
    preferredMealStyle:
      typeof preferences?.preferredMealStyle === "string"
        ? preferences.preferredMealStyle.trim()
        : "",
    prioritizeHighProtein: Boolean(preferences?.prioritizeHighProtein),
    prioritizeCheapMeals: Boolean(preferences?.prioritizeCheapMeals),
    prioritizeQuickMeals: Boolean(preferences?.prioritizeQuickMeals),
    kidFriendlyMeals: Boolean(preferences?.kidFriendlyMeals)
  };
}

function preferencesToPrompt(preferences) {
  const p = normalizePreferences(preferences);

  const lines = [];

  if (p.dislikedIngredients.length) {
    lines.push(`- Disliked or banned ingredients: ${p.dislikedIngredients.join(", ")}`);
  }

  if (p.preferredMealStyle) {
    lines.push(`- Preferred meal style: ${p.preferredMealStyle}`);
  }

  if (p.prioritizeHighProtein) {
    lines.push(`- Prioritize higher-protein meals`);
  }

  if (p.prioritizeCheapMeals) {
    lines.push(`- Prioritize cheaper meals and grocery choices`);
  }

  if (p.prioritizeQuickMeals) {
    lines.push(`- Prioritize quick low-friction meals`);
  }

  if (p.kidFriendlyMeals) {
    lines.push(`- Prefer kid-friendly meals when possible`);
  }

  if (!lines.length) {
    return "No saved preference memory.";
  }

  return lines.join("\n");
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
      temperature: 0.65,
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

function buildGenerateMessages(brainDump, preferences) {
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
  "groceryList": {
    "produce": [],
    "protein": [],
    "dairy": [],
    "pantry": [],
    "frozen": [],
    "other": []
  }
}

Rules:
- Only JSON
- No extra text
- Extract all explicit tasks from the brain dump
- Distribute tasks realistically across the week
- Aim for 2-3 core tasks per day when possible, but do not drop explicit user tasks
- Meals should be practical and realistic
- Respect exact food dislikes and restrictions from both the brain dump and saved preference memory
- Never leave a broken meal
- If a disliked or restricted ingredient is a core part of a meal, replace the entire meal with a complete alternative
- Grocery list must match meals

Grocery grouping rules:
- Group items into exactly these sections: produce, protein, dairy, pantry, frozen, other
- Always include all six section keys even if empty
- Consolidate duplicates
- Remove obvious redundancy
- If meals call for both "chicken" and "chicken breast", combine into the clearest single item
- Put uncategorized items into other
- Keep grocery items concise and useful for real shopping

Preference memory rules:
- Saved preferences should influence planning every time
- If a saved preference conflicts with a meal idea, choose a meal that fits the saved preference
- Saved preference memory should shape meals, not invent unrelated tasks
- If both the brain dump and saved preferences mention food constraints, follow both

Keep wording concise and human
      `.trim()
    },
    {
      role: "user",
      content: `
Brain dump:
${brainDump}

Saved preference memory:
${preferencesToPrompt(preferences)}
      `.trim()
    }
  ];
}

function buildQuickEditMessages(brainDump, existingPlan, editInstruction, preferences) {
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
  "groceryList": {
    "produce": [],
    "protein": [],
    "dairy": [],
    "pantry": [],
    "frozen": [],
    "other": []
  }
}

You must act like a smart planning assistant, not a literal text editor.

Rules:
- Apply only what the user requested
- Keep everything else the same
- Do not randomly rewrite the whole plan
- Do not drop explicit tasks unless the user clearly asks for that
- Do not add new tasks unless the user's edit explicitly asks for new tasks or clearly requires them
- Broad optimization edits like "make this week easier" or "make weekdays lighter" should reorganize, simplify, or shift flexible tasks, not invent new ones
- Meal-focused edits may change meals without adding unrelated tasks
- Meals must stay realistic
- Respect exact food dislikes and restrictions from both the brain dump and saved preference memory
- Never leave a broken meal
- If removing a core ingredient from a meal, replace the entire meal with a complete alternative
- Grocery list must match meals
- No extra text

Smart edit interpretation rules:
- You are allowed to interpret broad requests intelligently
- If the user says "make this week easier", reduce overload, simplify meals, and make lighter days where possible without deleting important obligations
- If the user says "make meals cheaper", choose lower-cost practical meals and update grocery list accordingly
- If the user says "higher protein", improve meals toward protein-focused options
- If the user says "reduce cooking time", prefer faster meals and lower-friction prep
- If the user says "make weekdays lighter", shift flexible items away from weekdays when reasonable
- If the user says "more variety", diversify meals without breaking restrictions
- If the user says "healthier", lean toward balanced realistic meals, not extreme diet meals
- If the user says "kid-friendly", choose simpler, broadly appealing meals
- If the user says "busy week", simplify wherever possible but keep core obligations
- If the user says "cheaper", prefer affordable proteins and pantry-friendly meals
- If the user says "cut grocery budget in half", aggressively simplify meals and choose lower-cost staples while keeping the plan usable
- If the request is vague, make the smallest useful change that matches the intent

Task handling rules:
- Keep explicit appointments and fixed commitments
- Flexible tasks may be shifted to nearby days if the user's request implies reducing overload
- Try not to overload any single day unless required by explicit commitments
- Aim for 2-3 core tasks per day when possible, but do not lose explicit user tasks

Meal handling rules:
- If a day becomes lighter, meals can also become simpler
- If the user requests convenience, use faster meals, leftovers, repeats, or easier lunches when appropriate
- If the user requests cheap meals, prefer simple staples like rice bowls, pasta, burrito bowls, sandwiches, eggs, beans, ground turkey, tuna, oats, potatoes, frozen veggies, and similar practical budget foods

Grocery grouping rules:
- Group items into exactly these sections: produce, protein, dairy, pantry, frozen, other
- Always include all six section keys even if empty
- Consolidate duplicates
- Remove obvious redundancy
- Use the clearest single item name when similar items overlap

Preference memory rules:
- Saved preferences should influence every edit
- Keep the plan aligned with saved meal priorities like quick, cheap, high protein, or kid-friendly when relevant
- If a saved food dislike conflicts with the current plan, edits should move further away from that ingredient, not toward it
      `.trim()
    },
    {
      role: "user",
      content: `
Brain dump:
${brainDump}

Saved preference memory:
${preferencesToPrompt(preferences)}

Current plan:
${JSON.stringify(existingPlan, null, 2)}

User request:
${editInstruction}
      `.trim()
    }
  ];
}

function buildMealDetailsMessages(brainDump, existingPlan, mealName, dayName, preferences) {
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
- Respect exact dislikes and restrictions from both the brain dump and saved preference memory
- Never output a broken meal
- If the named meal includes a restricted core ingredient, reinterpret it as the nearest complete allowed alternative
- If the meal is eating out or social, still provide useful output:
  - short description
  - minimal ingredients if appropriate
  - simple steps like what to order or how to prep
- If saved preference memory says quick, cheap, high protein, or kid-friendly, lean in that direction when it still fits the meal
      `.trim()
    },
    {
      role: "user",
      content: `
Brain dump:
${brainDump}

Saved preference memory:
${preferencesToPrompt(preferences)}

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

function buildMealTagsMessages(brainDump, existingPlan, preferences) {
  return [
    {
      role: "system",
      content: `
You are assigning helpful tags to meals in a weekly planning app called Life Manager.

Return ONLY valid JSON in this exact format:
{
  "monday": {
    "Meal Name": ["quick", "cheap"]
  },
  "tuesday": {
    "Meal Name": ["high protein"]
  },
  "wednesday": {},
  "thursday": {},
  "friday": {},
  "saturday": {},
  "sunday": {}
}

Rules:
- Only JSON
- No extra text
- Use exactly these days as top-level keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday
- For each meal in the plan, return that exact meal name as a key under its day
- Values must be arrays of short tags
- Allowed tags are only:
  - "quick"
  - "cheap"
  - "high protein"
  - "leftovers"
  - "kid-friendly"
- Use 0 to 3 tags per meal
- Only assign a tag when it is reasonably justified
- Respect the brain dump, saved preferences, and the actual meal wording
- Do not invent meals
- Do not rewrite meal names
- If a meal sounds like restaurant or social dining, you may still tag it if appropriate
- If a meal seems simple and low-effort, tag it as quick
- If a meal seems budget-friendly or based on staples, tag it as cheap
- If a meal has a strong protein focus, tag it as high protein
- If a meal is clearly repeatable or likely reused, tag it as leftovers
- If a meal sounds broadly simple and family friendly, tag it as kid-friendly
      `.trim()
    },
    {
      role: "user",
      content: `
Brain dump:
${brainDump}

Saved preference memory:
${preferencesToPrompt(preferences)}

Current weekly plan:
${JSON.stringify(existingPlan, null, 2)}
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

function normalizeMealTags(rawTags, plan) {
  const normalizedPlan = normalizePlan(plan);
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const allowedTags = new Set(["quick", "cheap", "high protein", "leftovers", "kid-friendly"]);
  const result = {};

  for (const day of days) {
    result[day] = {};
    const meals = normalizedPlan[day]?.meals || [];
    const rawDay = rawTags?.[day] && typeof rawTags[day] === "object" ? rawTags[day] : {};

    for (const meal of meals) {
      const tags = Array.isArray(rawDay[meal]) ? rawDay[meal] : [];
      result[day][meal] = tags
        .filter(tag => typeof tag === "string")
        .map(tag => tag.trim())
        .filter(tag => allowedTags.has(tag))
        .slice(0, 3);
    }
  }

  return result;
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
      dayName = "",
      preferences = {}
    } = req.body || {};

    if (!brainDump || typeof brainDump !== "string" || !brainDump.trim()) {
      return res.status(400).json({ error: "brainDump is required" });
    }

    const normalizedPreferences = normalizePreferences(preferences);

    if (mode === "generate") {
      const generated = await callOpenRouter(
        buildGenerateMessages(brainDump.trim(), normalizedPreferences)
      );

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
        buildQuickEditMessages(
          brainDump.trim(),
          normalizePlan(existingPlan),
          editInstruction.trim(),
          normalizedPreferences
        )
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
          dayName.trim(),
          normalizedPreferences
        )
      );

      return res.status(200).json({
        ...normalizeMealDetails(details, mealName.trim()),
        isFallback: false
      });
    }

    if (mode === "mealTags") {
      if (!existingPlan || typeof existingPlan !== "object") {
        return res.status(400).json({ error: "existingPlan is required for mealTags" });
      }

      const normalizedPlan = normalizePlan(existingPlan);

      const tags = await callOpenRouter(
        buildMealTagsMessages(
          brainDump.trim(),
          normalizedPlan,
          normalizedPreferences
        )
      );

      return res.status(200).json({
        tags: normalizeMealTags(tags, normalizedPlan),
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
