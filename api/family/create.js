import { supabase } from '../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const userId = authHeader

    const code = Math.random().toString(36).substring(2, 8)

    const { data: family, error } = await supabase
      .from('families')
      .insert({
        code,
        name: 'My Family',
        admin_id: userId
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    await supabase.from('family_members').insert({
      family_id: family.id,
      user_id: userId,
      role: 'admin'
    })

    return res.json({
      ...family,
      members: []
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
