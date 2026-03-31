import { supabase } from '../../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const userId = authHeader.trim()

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { code } = req.body || {}
    const cleanCode = String(code || '').trim().toLowerCase()

    if (!cleanCode) {
      return res.status(400).json({ error: 'Join code is required' })
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, family_id')
      .eq('id', userId)
      .maybeSingle()

    if (userError) {
      return res.status(500).json({ error: userError.message })
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.family_id) {
      return res.status(400).json({ error: 'User is already in a family' })
    }

    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id, code, name, admin_id')
      .eq('code', cleanCode)
      .maybeSingle()

    if (familyError) {
      return res.status(500).json({ error: familyError.message })
    }

    if (!family) {
      return res.status(404).json({ error: 'Family not found' })
    }

    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from('family_members')
      .select('user_id, family_id')
      .eq('user_id', userId)
      .eq('family_id', family.id)
      .maybeSingle()

    if (existingMembershipError) {
      return res.status(500).json({ error: existingMembershipError.message })
    }

    if (!existingMembership) {
      const { error: memberInsertError } = await supabase
        .from('family_members')
        .insert({
          user_id: userId,
          family_id: family.id,
          role: 'member'
        })

      if (memberInsertError) {
        return res.status(500).json({ error: memberInsertError.message })
      }
    }

    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        family_id: family.id
      })
      .eq('id', userId)

    if (updateUserError) {
      return res.status(500).json({ error: updateUserError.message })
    }

    return res.status(200).json({
      family,
      members: []
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to join family'
    })
  }
}
