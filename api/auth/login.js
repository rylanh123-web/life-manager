let users = global.users || []

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const { email, password } = req.body

  const user = users.find(
    u => u.email === email && u.password === password
  )

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" })
  }

  return res.json({
    token: user.id,
    user: { id: user.id, email: user.email }
  })
}
