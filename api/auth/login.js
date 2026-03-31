import { supabase } from '../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .maybeSingle()

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // 🔑 token = UUID
    return res.json({
      token: user.id,
      user: {
        id: user.id,
        email: user.email
      }
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
