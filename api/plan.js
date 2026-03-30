const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const DAY_NAMES = [
 "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
];

function safeArray(v){ return Array.isArray(v)?v.filter(Boolean).map(String):[] }
function safeString(v){ return typeof v==="string"?v.trim():"" }

function normalizePlan(plan){
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
 }
}

function cleanDay(day){
 return {
  tasks: safeArray(day?.tasks),
  meals: safeArray(day?.meals),
  busy: !!day?.busy
 }
}

function extractJson(text){
 try { return JSON.parse(text) }
 catch {
  const s=text.indexOf("{")
  const e=text.lastIndexOf("}")
  if(s!==-1 && e!==-1){
   try{return JSON.parse(text.slice(s,e+1))}catch{}
  }
 }
 return null
}

async function callAI(messages){
 const res = await fetch(OPENROUTER_URL,{
  method:"POST",
  headers:{
   Authorization:`Bearer ${OPENROUTER_API_KEY}`,
   "Content-Type":"application/json"
  },
  body:JSON.stringify({
   model:MODEL,
   messages,
   temperature:0.7,
   response_format:{type:"json_object"}
  })
 })

 if(!res.ok) throw new Error("AI error")

 const data = await res.json()
 const parsed = extractJson(data?.choices?.[0]?.message?.content||"")

 if(!parsed) throw new Error("Bad AI JSON")
 return parsed
}

function buildGenerate(brainDump){
 return [
  {
   role:"system",
   content:`
Return ONLY JSON:
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
- realistic meals
- distribute tasks
- busy days lighter
- grocery matches meals
`
  },
  { role:"user", content: brainDump }
 ]
}

function buildEdit(brainDump, plan, edit){
 return [
  {
   role:"system",
   content:`Edit existing plan. Return same JSON shape. Only apply requested change.`
  },
  {
   role:"user",
   content:`
Brain dump:
${brainDump}

Plan:
${JSON.stringify(plan)}

Edit:
${edit}
`
  }
 ]
}

function buildMealDetails(meal){
 return [
  {
   role:"system",
   content:`Return JSON: {title,description,prepTime,ingredients,steps}`
  },
  { role:"user", content: meal }
 ]
}

export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).end()

 try{
  const {mode,brainDump,existingPlan,editInstruction,mealName} = req.body

  if(mode==="generate"){
   const data = await callAI(buildGenerate(brainDump))
   return res.json(normalizePlan(data))
  }

  if(mode==="quickEdit"){
   const data = await callAI(buildEdit(brainDump,existingPlan,editInstruction))
   return res.json(normalizePlan(data))
  }

  if(mode==="mealDetails"){
   const data = await callAI(buildMealDetails(mealName))
   return res.json(data)
  }

  return res.status(400).json({error:"Invalid mode"})
 }
 catch(e){
  console.error(e)
  res.status(500).json({error:"Failed"})
 }
}
