import { supabase } from '../../lib/db.js'

function getUserIdFromAuthHeader(authHeader) {
  if (!authHeader) return null
  return authHeader.replace(/^demo-/, '').trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    const userId = getUserIdFromAuthHeader(authHeader)

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

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

    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        family_id: family.id,
        user_id: userId,
        role: 'admin'
      })

    if (memberError) {
      return res.status(500).json({ error: memberError.message })
    }

    const { error: userError } = await supabase
      .from('users')
      .update({
        family_id: family.id
      })
      .eq('id', userId)

    if (userError) {
      return res.status(500).json({ error: userError.message })
    }

    return res.json({
      ...family,
      members: []
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
