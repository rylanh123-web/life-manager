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

    const { code } = req.body

    const cleanCode = String(code || '').trim()

    const { data: family, error } = await supabase
      .from('families')
      .select('*')
      .eq('code', cleanCode)
      .single()

    if (error || !family) {
      return res.status(404).json({ error: 'Family not found' })
    }

    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        family_id: family.id,
        user_id: userId,
        role: 'member'
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
