let families = global.families || []

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const { code } = req.body

  const family = families.find(f => f.code === code)

  if (!family) {
    return res.status(404).json({ error: "Family not found" })
  }

  return res.json(family)
}
