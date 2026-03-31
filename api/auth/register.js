import { supabase } from '../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    // check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ error: 'User exists' })
    }

    // create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password,
        name: email
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // 🔑 IMPORTANT: token = user.id (UUID)
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
