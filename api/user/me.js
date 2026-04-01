import { supabase } from '../../lib/db.js'

function getTokenFromReq(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization

  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  return authHeader.trim()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = getTokenFromReq(req)

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, family_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.status(200).json(user)
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to load user'
    })
  }
}
