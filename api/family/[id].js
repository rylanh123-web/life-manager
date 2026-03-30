import { supabase } from '../../lib/db.js'
import { getAuthUser } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authUser = await getAuthUser(req)
    const { id } = req.query

    if (!id) {
      return res.status(400).json({ error: 'Family id is required' })
    }

    if (!authUser.family_id || authUser.family_id !== id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id, code, name, admin_id')
      .eq('id', id)
      .maybeSingle()

    if (familyError) {
      return res.status(500).json({ error: familyError.message })
    }

    if (!family) {
      return res.status(404).json({ error: 'Family not found' })
    }

    const { data: memberships, error: membersError } = await supabase
      .from('family_members')
      .select(`
        role,
        users:user_id (
          id,
          name,
          email
        )
      `)
      .eq('family_id', id)

    if (membersError) {
      return res.status(500).json({ error: membersError.message })
    }

    const members = (memberships || [])
      .filter(row => row.users)
      .map(row => ({
        id: row.users.id,
        name: row.users.name,
        email: row.users.email,
        role: row.role
      }))

    return res.status(200).json({
      family,
      members
    })
  } catch (error) {
    return res.status(401).json({
      error: error.message || 'Unauthorized'
    })
  }
}
