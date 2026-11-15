import { prisma } from './prisma'

function sanitize(base: string) {
  return base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

/**
 * Generates a unique username from an email local-part, display name, or
 * explicit preference, appending a numeric suffix on collisions.
 * Returns null only in the unlikely event no candidate is found.
 */
export async function generateUniqueUsername(seed: {
  email?: string | null
  name?: string | null
  preferred?: string | null
}): Promise<string | null> {
  const raw = seed.preferred || seed.email?.split('@')[0] || seed.name || 'user'
  let base = sanitize(raw) || 'user'
  if (base.length < 3) base = `${base}user`.slice(0, 30)

  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 27)}${i + 1}`.slice(0, 30)
    const exists = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  return null
}
