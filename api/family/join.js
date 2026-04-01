import { supabase } from '../../lib/db.js'
import { getAuthUser } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authUser = await getAuthUser(req)
    const { code } = req.body || {}

    if (!code) {
      return res.status(400).json({ error: 'Missing family code' })
    }

    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (familyError) {
      return res.status(500).json({ error: familyError.message })
    }

    if (!family) {
      return res.status(404).json({ error: 'Family not found' })
    }

    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        family_id: family.id,
        user_id: authUser.id,
        role: 'member'
      })

    if (memberError && memberError.code !== '23505') {
      return res.status(500).json({ error: memberError.message })
    }

    const { error: userError } = await supabase
      .from('users')
      .update({
        family_id: family.id
      })
      .eq('id', authUser.id)

    if (userError) {
      return res.status(500).json({ error: userError.message })
    }

    return res.json({
      family,
      joined: true
    })
  } catch (err) {
    return res.status(401).json({ error: err.message })
  }
}
