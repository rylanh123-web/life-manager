let families = global.families || []

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const code = Math.random().toString(36).substring(2, 8)

  const family = {
    id: Date.now().toString(),
    code,
    members: []
  }

  families.push(family)
  global.families = families

  return res.json(family)
}
