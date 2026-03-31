import { supabase } from '../../lib/db.js'
import { getAuthUser } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const authUser = await getAuthUser(req)
      const { family_id, week_start, day, meal } = req.body

      if (!family_id || !week_start || !day || !meal) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // 🔐 Verify authenticated user belongs to this family
      const { data: membership, error: memberError } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('family_id', family_id)
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (memberError) {
        return res.status(500).json({ error: memberError.message })
      }

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this family' })
      }

      const { data: vote, error } = await supabase
        .from('votes')
        .insert({
          family_id,
          week_start,
          day,
          meal,
          user_id: authUser.id
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505' || error.message.includes('duplicate key')) {
          return res.status(200).json({ message: 'Already voted' })
        }
        return res.status(500).json({ error: error.message })
      }

      return res.status(201).json({ vote })
    } catch (err) {
      return res.status(401).json({ error: err.message })
    }
  }

  if (req.method === 'GET') {
    try {
      const authUser = await getAuthUser(req)
      const { family_id, week_start } = req.query

      if (!family_id || !week_start) {
        return res.status(400).json({ error: 'Missing family_id or week_start' })
      }

      // 🔐 Verify authenticated user belongs to this family
      const { data: membership, error: memberError } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('family_id', family_id)
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (memberError) {
        return res.status(500).json({ error: memberError.message })
      }

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this family' })
      }

      const { data: votes, error } = await supabase
        .from('votes')
        .select('id, day, meal, user_id, created_at')
        .eq('family_id', family_id)
        .eq('week_start', week_start)

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ votes })
    } catch (err) {
      return res.status(401).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
