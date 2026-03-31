import { supabase } from '../../lib/db.js'
import { getAuthUser } from '../../lib/auth.js'

function generateFamilyCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return code
}

async function createUniqueFamilyCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateFamilyCode()

    const { data, error } = await supabase
      .from('families')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (error) throw error
    if (!data) return code
  }

  throw new Error('Could not generate a unique family code')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authUser = await getAuthUser(req)

    if (authUser.family_id) {
      return res.status(400).json({ error: 'User is already in a family' })
    }

    const code = await createUniqueFamilyCode()

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({
        code,
        name: `${authUser.name || 'Family'} Family`,
        admin_id: authUser.id
      })
      .select('id, code, name, admin_id')
      .single()

    if (familyError) {
      return res.status(500).json({ error: familyError.message })
    }

    const { error: memberError } = await supabase
      .from('family_members')
      .insert({
        user_id: authUser.id,
        family_id: family.id,
        role: 'admin'
      })

    if (memberError) {
      return res.status(500).json({ error: memberError.message })
    }

    const { error: userError } = await supabase
      .from('users')
      .update({
        family_id: family.id,
        role: 'admin'
      })
      .eq('id', authUser.id)

    if (userError) {
      return res.status(500).json({ error: userError.message })
    }

    return res.status(200).json({
      family,
      members: [
        {
          id: authUser.id,
          name: authUser.name,
          email: authUser.email,
          role: 'admin'
        }
      ]
    })
  } catch (error) {
    return res.status(401).json({
      error: error.message || 'Unauthorized'
    })
  }
}
