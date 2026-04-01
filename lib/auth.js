import { supabase } from './db.js'

// Extract token from Authorization header
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

export async function getAuthUser(req) {
  const token = getTokenFromReq(req)

  // In this app, token = user.id
  const userId = token

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !user) {
    throw new Error('User not found')
  }

  return user
}
