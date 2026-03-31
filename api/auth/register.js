import { supabase } from '../../lib/db.js'

function generateToken(user) {
  return `demo-${user.id}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body || {}

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const cleanEmail = String(email).trim().toLowerCase()
    const cleanPassword = String(password).trim()

    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existingError) {
      return res.status(500).json({ error: existingError.message })
    }

    if (existingUser) {
      return res.status(400).json({ error: 'User exists' })
    }

    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        email: cleanEmail,
        password: cleanPassword,
        name: cleanEmail.split('@')[0]
      })
      .select('id, email, name')
      .single()

    if (insertError) {
      return res.status(500).json({ error: insertError.message })
    }

    return res.json({
      token: generateToken(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to register'
    })
  }
}
