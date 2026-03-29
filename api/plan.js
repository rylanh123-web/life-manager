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
  groceryList: [],
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function safeDay(day) {
  return {
    tasks: safeArray(day?.tasks),
    meals: safeArray(day?.meals),
    busy: Boolean(day?.busy),
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
    groceryList: safeArray(plan?.groceryList),
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
      const sliced = text.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced);
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content returned from model");
  }

  const parsed = extractJson(content);

  if (!parsed) {
    throw new Error("Model did not return valid JSON");
  }

  return parsed;
}

function buildGenerateMessages(brainDump) {
  return [
    {
      role: "system",
      content: `
You are generating a weekly life plan for a real product called Life Manager.

This is NOT a generic planner.
The result must feel human, practical, realistic, and actually usable in real life.

Return ONLY valid JSON matching this exact shape:
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
- NO extra text
- ONLY JSON
- Extract ALL tasks from the brain dump
- NEVER drop tasks
- Distribute tasks across the correct days
- If user says "work 9-5 monday through friday", apply it to all weekdays
- If user says "gym 3 times", spread it across the week
- If work exists, weekdays should not be empty
- Work days should usually be busy
- Gym days should usually be busy
- Weekends should be lighter but not empty unless explicitly intended

Meal rules:
- Only include meals if the user mentions food, groceries, cooking, eating, dinner plans, or food preferences
- Each meal day should have 2-3 meals
- Meals must be realistic, varied, and practical
- Reflect cooking vs eating out if implied
- Respect dislikes and restrictions exactly
- Example: if user says "I hate chicken", do not include chicken
- If user says "dinner with friends", that counts as a meal
- Grocery list should match the meals

Keep wording natural and concise.
      `.trim(),
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}`,
    },
  ];
}

function buildRegenerateMealsMessages(brainDump, existingPlan) {
  return [
    {
      role: "system",
      content: `
You are updating a weekly plan for a real product called Life Manager.

Return ONLY valid JSON matching this exact shape:
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

Critical rules:
- KEEP ALL TASKS EXACTLY THE SAME as the existing plan
- DO NOT add tasks
- DO NOT remove tasks
- DO NOT rewrite task text
- KEEP busy flags the same unless absolutely necessary for validity
- ONLY regenerate meals and groceryList
- NO extra text
- ONLY JSON

Meal rules:
- Meals must feel human, practical, and realistic
- Vary meals across the week
- Respect user dislikes and restrictions exactly
- Example: if user says "I hate chicken", do not include chicken
- If the user mentioned food/groceries/cooking/preferences, provide 2-3 meals per relevant day
- If a day already has an event meal like dinner with friends, that can stay as a meal concept but you may rewrite the meal lineup around it
- Grocery list should match the new meals

The final output must preserve the exact tasks from the existing plan.
      `.trim(),
    },
    {
      role: "user",
      content: `Original brain dump:\n${brainDump}\n\nExisting plan:\n${JSON.stringify(existingPlan, null, 2)}`,
    },
  ];
}

function buildRegenerateDayMealsMessages(brainDump, existingPlan, targetDay) {
  return [
    {
      role: "system",
      content: `
You are updating ONLY THE MEALS for ONE DAY inside a weekly plan for a real product called Life Manager.

Return ONLY valid JSON with this exact shape:
{
  "day": { "tasks": [], "meals": [], "busy": false }
}

Critical rules:
- ONLY regenerate meals for the requested day
- KEEP that day's tasks exactly the same as the existing plan
- DO NOT add tasks
- DO NOT remove tasks
- DO NOT rewrite task text
- Keep busy the same unless clearly needed by the unchanged day structure
- NO extra text
- ONLY JSON

Meal rules:
- Meals must feel human, practical, and realistic
- Respect user dislikes and restrictions exactly
- Example: if user says "I hate chicken", do not include chicken
- If the user mentioned food/groceries/cooking/preferences, provide 2-3 meals for the day when appropriate
- If the day includes an event meal like dinner with friends, that counts as a meal
      `.trim(),
    },
    {
      role: "user",
      content: `Original brain dump:\n${brainDump}\n\nTarget day:\n${targetDay}\n\nExisting full plan:\n${JSON.stringify(existingPlan, null, 2)}\n\nExisting ${targetDay} data:\n${JSON.stringify(existingPlan[targetDay], null, 2)}`,
    },
  ];
}

function buildRegenerateDayTasksMessages(brainDump, existingPlan, targetDay) {
  return [
    {
      role: "system",
      content: `
You are updating ONLY THE TASKS for ONE DAY inside a weekly plan for a real product called Life Manager.

Return ONLY valid JSON with this exact shape:
{
  "day": { "tasks": [], "meals": [], "busy": false }
}

Critical rules:
- ONLY regenerate tasks for the requested day
- KEEP that day's meals exactly the same as the existing plan
- DO NOT add meals
- DO NOT remove meals
- DO NOT rewrite meal text
- Tasks must still reflect the user's original brain dump
- NEVER invent weird or robotic tasks
- Make the day practical and usable in real life
- You may update busy if needed based on the new task load
- NO extra text
- ONLY JSON

Task rules:
- Preserve the meaning of the user's week
- Tasks should be concise, natural, and actionable
- Do not duplicate obvious tasks unnecessarily
- Do not leave the day empty unless that makes clear sense
      `.trim(),
    },
    {
      role: "user",
      content: `Original brain dump:\n${brainDump}\n\nTarget day:\n${targetDay}\n\nExisting full plan:\n${JSON.stringify(existingPlan, null, 2)}\n\nExisting ${targetDay} data:\n${JSON.stringify(existingPlan[targetDay], null, 2)}`,
    },
  ];
}

function buildRegenerateWholeDayMessages(brainDump, existingPlan, targetDay) {
  return [
    {
      role: "system",
      content: `
You are regenerating ONE FULL DAY inside a weekly plan for a real product called Life Manager.

Return ONLY valid JSON with this exact shape:
{
  "day": { "tasks": [], "meals": [], "busy": false }
}

Critical rules:
- ONLY regenerate the requested day
- DO NOT touch any other days
- The new day must still fit the user's original brain dump and the overall weekly plan
- Make the day feel human, practical, realistic, and usable
- NO extra text
- ONLY JSON

Task rules:
- Tasks should reflect the user's real obligations and goals
- Use concise, natural wording
- Avoid robotic filler

Meal rules:
- Respect food dislikes and restrictions exactly
- Example: if user says "I hate chicken", do not include chicken
- If the day should include meals, provide 2-3 realistic meals
- If the user did not mention food/groceries/cooking/preferences, meals can remain empty
      `.trim(),
    },
    {
      role: "user",
      content: `Original brain dump:\n${brainDump}\n\nTarget day:\n${targetDay}\n\nExisting full plan:\n${JSON.stringify(existingPlan, null, 2)}\n\nExisting ${targetDay} data:\n${JSON.stringify(existingPlan[targetDay], null, 2)}`,
    },
  ];
}

function buildRebuildGroceryMessages(brainDump, existingPlan) {
  return [
    {
      role: "system",
      content: `
You are rebuilding ONLY the grocery list for a weekly plan in a real product called Life Manager.

Return ONLY valid JSON with this exact shape:
{
  "groceryList": []
}

Critical rules:
- Look at the weekly meals in the provided plan
- Build a practical grocery list that matches those meals
- Keep it concise and realistic
- Combine duplicate ingredients
- Do not include tasks
- Do not include any extra text
- ONLY JSON
      `.trim(),
    },
    {
      role: "user",
      content: `Original brain dump:\n${brainDump}\n\nExisting plan with current meals:\n${JSON.stringify(existingPlan, null, 2)}`,
    },
  ];
}

async function rebuildGroceryList(brainDump, plan) {
  const groceryResponse = await callOpenRouter(
    buildRebuildGroceryMessages(brainDump, plan)
  );

  return safeArray(groceryResponse?.groceryList);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
  }

  try {
    const {
      brainDump = "",
      mode = "generate",
      existingPlan = null,
      targetDay = null,
    } = req.body || {};

    if (!brainDump || typeof brainDump !== "string") {
      return res.status(400).json({ error: "brainDump is required" });
    }

    let plan;

    if (mode === "regenerateMeals") {
      if (!existingPlan || typeof existingPlan !== "object") {
        return res.status(400).json({ error: "existingPlan is required for regenerateMeals" });
      }

      const normalizedExistingPlan = normalizePlan(existingPlan);
      const aiRaw = await callOpenRouter(
        buildRegenerateMealsMessages(brainDump, normalizedExistingPlan)
      );
      const aiPlan = normalizePlan(aiRaw);

      plan = {
        ...aiPlan,
        monday: {
          ...aiPlan.monday,
          tasks: normalizedExistingPlan.monday.tasks,
          busy: normalizedExistingPlan.monday.busy,
        },
        tuesday: {
          ...aiPlan.tuesday,
          tasks: normalizedExistingPlan.tuesday.tasks,
          busy: normalizedExistingPlan.tuesday.busy,
        },
        wednesday: {
          ...aiPlan.wednesday,
          tasks: normalizedExistingPlan.wednesday.tasks,
          busy: normalizedExistingPlan.wednesday.busy,
        },
        thursday: {
          ...aiPlan.thursday,
          tasks: normalizedExistingPlan.thursday.tasks,
          busy: normalizedExistingPlan.thursday.busy,
        },
        friday: {
          ...aiPlan.friday,
          tasks: normalizedExistingPlan.friday.tasks,
          busy: normalizedExistingPlan.friday.busy,
        },
        saturday: {
          ...aiPlan.saturday,
          tasks: normalizedExistingPlan.saturday.tasks,
          busy: normalizedExistingPlan.saturday.busy,
        },
        sunday: {
          ...aiPlan.sunday,
          tasks: normalizedExistingPlan.sunday.tasks,
          busy: normalizedExistingPlan.sunday.busy,
        },
        groceryList: safeArray(aiPlan.groceryList),
      };
    } else if (
      mode === "regenerateDayMeals" ||
      mode === "regenerateDayTasks" ||
      mode === "regenerateWholeDay"
    ) {
      if (!existingPlan || typeof existingPlan !== "object") {
        return res.status(400).json({ error: "existingPlan is required for day regeneration" });
      }

      if (!targetDay || !DAYS.includes(targetDay)) {
        return res.status(400).json({ error: "valid targetDay is required" });
      }

      const normalizedExistingPlan = normalizePlan(existingPlan);
      let dayResponse;

      if (mode === "regenerateDayMeals") {
        dayResponse = await callOpenRouter(
          buildRegenerateDayMealsMessages(brainDump, normalizedExistingPlan, targetDay)
        );
      } else if (mode === "regenerateDayTasks") {
        dayResponse = await callOpenRouter(
          buildRegenerateDayTasksMessages(brainDump, normalizedExistingPlan, targetDay)
        );
      } else {
        dayResponse = await callOpenRouter(
          buildRegenerateWholeDayMessages(brainDump, normalizedExistingPlan, targetDay)
        );
      }

      const aiDay = safeDay(dayResponse?.day);

      const updatedDay =
        mode === "regenerateDayMeals"
          ? {
              tasks: normalizedExistingPlan[targetDay].tasks,
              meals: aiDay.meals,
              busy:
                typeof aiDay.busy === "boolean"
                  ? aiDay.busy
                  : normalizedExistingPlan[targetDay].busy,
            }
          : mode === "regenerateDayTasks"
          ? {
              tasks: aiDay.tasks,
              meals: normalizedExistingPlan[targetDay].meals,
              busy:
                typeof aiDay.busy === "boolean"
                  ? aiDay.busy
                  : normalizedExistingPlan[targetDay].busy,
            }
          : {
              tasks: aiDay.tasks,
              meals: aiDay.meals,
              busy:
                typeof aiDay.busy === "boolean"
                  ? aiDay.busy
                  : normalizedExistingPlan[targetDay].busy,
            };

      const updatedPlan = {
        ...normalizedExistingPlan,
        [targetDay]: updatedDay,
      };

      plan = {
        ...updatedPlan,
        groceryList: await rebuildGroceryList(brainDump, updatedPlan),
      };
    } else {
      const generatedRaw = await callOpenRouter(buildGenerateMessages(brainDump));
      plan = normalizePlan(generatedRaw);
    }

    return res.status(200).json(normalizePlan(plan));
  } catch (error) {
    console.error("Plan API error:", error);

    return res.status(500).json({
      error: "Failed to generate plan",
      details: error.message || "Unknown error",
      fallback: EMPTY_PLAN,
    });
  }
}
