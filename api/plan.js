const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const DAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

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

const EMPTY_CALENDAR_CONTEXT = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: []
};

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function safeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTime(value) {
  if (typeof value !== "string") return "";

  const raw = value.trim();
  if (!raw) return "";

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":");
    const hour = Number(h);
    const min = Number(m);
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
    return raw;
  }

  if (/^\d{1,2}$/.test(raw)) {
    const hour = Number(raw);
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:00`;
    }
    return raw;
  }

  if (/^\d{3,4}$/.test(raw)) {
    const padded = raw.padStart(4, "0");
    const hour = Number(padded.slice(0, 2));
    const min = Number(padded.slice(2, 4));
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }

  return raw;
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
    preferredMealStyle: safeTrimmedString(preferences?.preferredMealStyle),
    prioritizeHighProtein: Boolean(preferences?.prioritizeHighProtein),
    prioritizeCheapMeals: Boolean(preferences?.prioritizeCheapMeals),
    prioritizeQuickMeals: Boolean(preferences?.prioritizeQuickMeals),
    kidFriendlyMeals: Boolean(preferences?.kidFriendlyMeals)
  };
}

function normalizeCalendarEvent(event) {
  if (!event || typeof event !== "object") return null;

  const title = safeTrimmedString(event.title);
  const start = normalizeTime(event.start);
  const end = normalizeTime(event.end);
  const note = safeTrimmedString(event.note);

  if (!title && !start && !end && !note) return null;

  return {
    title: title || "Untitled event",
    start,
    end,
    note,
    fixed: event.fixed !== false,
    allDay: Boolean(event.allDay)
  };
}

function normalizeCalendarContext(calendarContext) {
  const normalized = { ...EMPTY_CALENDAR_CONTEXT };

  for (const day of DAY_NAMES) {
    const events = Array.isArray(calendarContext?.[day]) ? calendarContext[day] : [];
    normalized[day] = events.map(normalizeCalendarEvent).filter(Boolean);
  }

  return normalized;
}

function hasCalendarContext(calendarContext) {
  return DAY_NAMES.some((day) => Array.isArray(calendarContext?.[day]) && calendarContext[day].length > 0);
}

function formatCalendarEvent(event) {
  const timePart = event.allDay
    ? "all day"
    : event.start && event.end
      ? `${event.start}-${event.end}`
      : event.start
        ? `starts ${event.start}`
        : event.end
          ? `ends ${event.end}`
          : "time unspecified";

  const fixedPart = event.fixed ? "fixed" : "flexible";
  const notePart = event.note ? ` (${event.note})` : "";

  return `${event.title} [${timePart}, ${fixedPart}]${notePart}`;
}

function calendarContextToPrompt(calendarContext) {
  const normalized = normalizeCalendarContext(calendarContext);

  if (!hasCalendarContext(normalized)) {
    return "No calendar context";
  }

  return DAY_NAMES.map((day) => {
    const events = normalized[day];
    if (!events.length) return `- ${day}: open`;
    return `- ${day}: ${events.map(formatCalendarEvent).join("; ")}`;
  }).join("\n");
}

function preferencesToPrompt(preferences) {
  const p = normalizePreferences(preferences);
  const lines = [];

  if (p.dislikedIngredients.length) lines.push(`- Disliked: ${p.dislikedIngredients.join(", ")}`);
  if (p.preferredMealStyle) lines.push(`- Style: ${p.preferredMealStyle}`);
  if (p.prioritizeHighProtein) lines.push("- High protein");
  if (p.prioritizeCheapMeals) lines.push("- Cheap meals");
  if (p.prioritizeQuickMeals) lines.push("- Quick meals");
  if (p.kidFriendlyMeals) lines.push("- Kid-friendly");

  return lines.length ? lines.join("\n") : "No saved preferences";
}

function extractJson(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1));
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
    throw new Error(`OpenRouter error: ${response.status}`);
  }

  const data = await response.json();
  const parsed = extractJson(data?.choices?.[0]?.message?.content || "");

  if (!parsed) {
    throw new Error("Invalid JSON from model");
  }

  return parsed;
}

function buildGenerateMessages(brainDump, preferences, calendarContext) {
  const normalizedCalendarContext = normalizeCalendarContext(calendarContext);

  return [
    {
      role: "system",
      content: `
You are generating a weekly life plan for Life Manager.

Return ONLY valid JSON:
{"monday":{"tasks":[],"meals":[],"busy":false},"tuesday":{"tasks":[],"meals":[],"busy":false},"wednesday":{"tasks":[],"meals":[],"busy":false},"thursday":{"tasks":[],"meals":[],"busy":false},"friday":{"tasks":[],"meals":[],"busy":false},"saturday":{"tasks":[],"meals":[],"busy":false},"sunday":{"tasks":[],"meals":[],"busy":false},"groceryList":{"produce":[],"protein":[],"dairy":[],"pantry":[],"frozen":[],"other":[]}}

Core rules:
- Detect busy days from schedules, events, commitments, appointments, work blocks, gym, travel, date nights, and calendar context
- Busy days must be marked busy: true
- Use calendar context as a real constraint when deciding task load and meal simplicity
- Fixed events and busy windows should shape the week automatically
- Full workdays or stacked events should usually be busy
- Evening events should usually mean simpler dinner and lighter task load
- Calendar times may contain small user-entered typos like "17" instead of "17:00"; still use the event as planning context
- Busy days = MAX 1-2 tasks, simpler meals
- Non-busy days = 2-3 tasks, normal meals
- Extract all explicit tasks and do not drop them
- Distribute tasks realistically across the week
- Keep weekends lighter unless the input clearly suggests otherwise
- Meals must be practical and realistic
- Respect food dislikes from brain dump AND saved preferences
- If removing a core ingredient, replace the ENTIRE meal with a complete alternative
- Grocery list must match meals and be grouped by section
- Consolidate duplicates where reasonable
- Keep wording concise and human

Saved preferences:
${preferencesToPrompt(preferences)}

Calendar context:
${calendarContextToPrompt(normalizedCalendarContext)}
`.trim()
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}`
    }
  ];
}

function buildQuickEditMessages(brainDump, existingPlan, editInstruction, preferences, calendarContext) {
  const normalizedCalendarContext = normalizeCalendarContext(calendarContext);

  return [
    {
      role: "system",
      content: `
You are editing an existing weekly plan.

Return ONLY valid JSON:
{"monday":{"tasks":[],"meals":[],"busy":false},"tuesday":{"tasks":[],"meals":[],"busy":false},"wednesday":{"tasks":[],"meals":[],"busy":false},"thursday":{"tasks":[],"meals":[],"busy":false},"friday":{"tasks":[],"meals":[],"busy":false},"saturday":{"tasks":[],"meals":[],"busy":false},"sunday":{"tasks":[],"meals":[],"busy":false},"groceryList":{"produce":[],"protein":[],"dairy":[],"pantry":[],"frozen":[],"other":[]}}

Core rules:
- Apply only what the user requested and keep everything else as intact as possible
- Do NOT rewrite the whole plan unless the edit clearly requires it
- Do NOT add new tasks unless the edit explicitly asks for it
- Respect existing fixed commitments, busy windows, and calendar context
- If calendar context makes a day constrained, do not overload that day
- Broad edits like "easier week" should reduce overload and simplify meals
- "make weekdays lighter" should shift flexible tasks toward more open days when possible
- "cheaper meals" should use budget proteins and pantry staples
- "faster meals" should favor quick, simple meals
- Keep busy-day logic realistic after the edit
- Calendar times may contain small user-entered typos like "17" instead of "17:00"; still use the event as planning context
- Never leave broken meals
- If a core ingredient is removed or disallowed, replace the ENTIRE meal with a complete alternative
- Grocery list must match updated meals
- Respect preferences

Saved preferences:
${preferencesToPrompt(preferences)}

Calendar context:
${calendarContextToPrompt(normalizedCalendarContext)}
`.trim()
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}\n\nCurrent plan:\n${JSON.stringify(existingPlan)}\n\nEdit: ${editInstruction}`
    }
  ];
}

function buildMealDetailsMessages(brainDump, existingPlan, mealName, dayName, preferences) {
  return [
    {
      role: "system",
      content: `
Create a meal detail card.

Return ONLY JSON:
{"title":"","description":"","prepTime":"","ingredients":[],"steps":[]}

Rules:
- Description: 1 short sentence
- Prep time realistic
- 3-5 simple steps
- Keep it practical, not blog-style
- Respect dislikes from brain dump AND preferences
- If a restricted core ingredient is involved, replace with a complete alternative
- If the meal is eating out, social, or takeout, still make it useful and practical

Saved preferences:
${preferencesToPrompt(preferences)}
`.trim()
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}\n\nPlan:\n${JSON.stringify(existingPlan)}\n\nDay: ${dayName}\nMeal: ${mealName}`
    }
  ];
}

function buildMealTagsMessages(brainDump, existingPlan, mealName, dayName, preferences) {
  return [
    {
      role: "system",
      content: `
Classify a meal.

Return ONLY JSON:
{"tags":[]}

Allowed tags:
- quick
- cheap
- high protein
- leftovers
- kid-friendly

Rules:
- Max 3 tags
- Only include tags that genuinely fit
- Do not over-tag

Saved preferences:
${preferencesToPrompt(preferences)}
`.trim()
    },
    {
      role: "user",
      content: `Brain dump:\n${brainDump}\n\nPlan:\n${JSON.stringify(existingPlan)}\n\nDay: ${dayName}\nMeal: ${mealName}`
    }
  ];
}

function normalizeMealDetails(details, mealName) {
  return {
    title: safeTrimmedString(details?.title) || mealName,
    description: safeTrimmedString(details?.description),
    prepTime: safeTrimmedString(details?.prepTime),
    ingredients: safeArray(details?.ingredients),
    steps: safeArray(details?.steps)
  };
}

function normalizeMealTags(tagsPayload) {
  const allowed = new Set(["quick", "cheap", "high protein", "leftovers", "kid-friendly"]);

  return safeArray(tagsPayload?.tags)
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => allowed.has(tag))
    .slice(0, 3);
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
      mode,
      brainDump,
      existingPlan,
      editInstruction,
      mealName,
      dayName,
      preferences,
      calendarContext
    } = req.body || {};

    if (!brainDump || !brainDump.trim()) {
      return res.status(400).json({ error: "brainDump required" });
    }

    const normalizedPreferences = normalizePreferences(preferences);
    const normalizedCalendarContext = normalizeCalendarContext(calendarContext);

    if (mode === "generate") {
      const generated = await callOpenRouter(
        buildGenerateMessages(
          brainDump.trim(),
          normalizedPreferences,
          normalizedCalendarContext
        )
      );

      return res.status(200).json({
        ...normalizePlan(generated),
        isFallback: false
      });
    }

    if (mode === "quickEdit") {
      if (!existingPlan) {
        return res.status(400).json({ error: "existingPlan required" });
      }

      if (!editInstruction?.trim()) {
        return res.status(400).json({ error: "editInstruction required" });
      }

      const updated = await callOpenRouter(
        buildQuickEditMessages(
          brainDump.trim(),
          normalizePlan(existingPlan),
          editInstruction.trim(),
          normalizedPreferences,
          normalizedCalendarContext
        )
      );

      return res.status(200).json({
        ...normalizePlan(updated),
        isFallback: false
      });
    }

    if (mode === "mealDetails") {
      if (!existingPlan) {
        return res.status(400).json({ error: "existingPlan required" });
      }

      if (!mealName?.trim() || !dayName?.trim()) {
        return res.status(400).json({ error: "mealName and dayName required" });
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
      if (!existingPlan) {
        return res.status(400).json({ error: "existingPlan required" });
      }

      if (!mealName?.trim() || !dayName?.trim()) {
        return res.status(400).json({ error: "mealName and dayName required" });
      }

      const tags = await callOpenRouter(
        buildMealTagsMessages(
          brainDump.trim(),
          normalizePlan(existingPlan),
          mealName.trim(),
          dayName.trim(),
          normalizedPreferences
        )
      );

      return res.status(200).json({
        tags: normalizeMealTags(tags),
        isFallback: false
      });
    }

    return res.status(400).json({ error: "Unsupported mode" });
  } catch (error) {
    console.error("Plan API error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate plan" });
  }
}
