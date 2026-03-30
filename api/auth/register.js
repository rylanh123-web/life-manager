let users = []

export default function handler(req, res) {
 if (req.method !== "POST") return res.status(405).end()

 const { email, password } = req.body

 if (!email || !password) {
  return res.status(400).json({ error: "Missing fields" })
 }

 const existing = users.find(u => u.email === email)
 if (existing) {
  return res.status(400).json({ error: "User exists" })
 }

 const user = { id: Date.now(), email, password }
 users.push(user)

 return res.json({ token: String(user.id) })
}
