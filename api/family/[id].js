import { supabase } from '../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id) {
      return res.status(400).json({ error: 'Family id is required' })
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
      .select('user_id, family_id, role')
      .eq('family_id', id)

    if (membersError) {
      return res.status(500).json({ error: membersError.message })
    }

    const userIds = (memberships || []).map(row => row.user_id)

    let users = []
    if (userIds.length) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', userIds)

      if (usersError) {
        return res.status(500).json({ error: usersError.message })
      }

      users = usersData || []
    }

    const members = (memberships || []).map(row => {
      const user = users.find(u => u.id === row.user_id)

      return {
        id: row.user_id,
        name: user?.name || user?.email || 'Unknown',
        email: user?.email || '',
        role: row.role || 'member'
      }
    })

    return res.status(200).json({
      family,
      members
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to load family members'
    })
  }
}
