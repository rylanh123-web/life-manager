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
    const { code } = req.body

    const { data: family, error } = await supabase
      .from('families')
      .select('*')
      .eq('code', code)
      .single()

    if (error || !family) {
      return res.status(404).json({ error: 'Family not found' })
    }

    await supabase.from('family_members').insert({
      family_id: family.id,
      user_id: userId,
      role: 'member'
    })

    return res.json({
      ...family,
      members: []
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
