'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { provisionOrgFromMaster } from '@/lib/organization-template'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { headers } from 'next/headers'

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export type RegisterState = { ok?: boolean; error?: string }

function trialEndsAt() {
  const days = Number(process.env.TRIAL_PERIOD_DAYS) || 14
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export async function registerOrganization(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  try {
    const ownerName = String(formData.get('ownerName') || '').trim()
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const phone = String(formData.get('phone') || '').trim()
    const password = String(formData.get('password') || '')
    const orgName = String(formData.get('orgName') || '').trim()
    let slug = String(formData.get('slug') || '').trim()

    if (!ownerName || !email || !password || !orgName) {
      return { error: 'All required fields must be filled.' }
    }
    if (password.length < 8) {
      return { error: 'Password must be at least 8 characters.' }
    }

    const hdrs = await headers()
    const ip = clientIp(hdrs)
    if (!rateLimit(`register:ip:${ip}`, 10, 60 * 60 * 1000) || !rateLimit(`register:email:${email}`, 5, 60 * 60 * 1000)) {
      return { error: 'Too many registration attempts. Please try again later.' }
    }
    if (!slug) slug = slugify(orgName)
    slug = slugify(slug)
    if (!slug) {
      return { error: 'Organization subdomain is required.' }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return { error: 'An account with this email already exists. Please sign in instead.' }
    }
    const existingSlug = await prisma.organization.findUnique({ where: { slug } })
    if (existingSlug) {
      return { error: 'This subdomain is already taken. Please choose a different one.' }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: ownerName,
          email,
          phone: phone || null,
          passwordHash,
          globalRole: 'standard',
        },
        select: { id: true },
      })

      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          ownerUserId: user.id,
          status: 'active',
          subscriptionPlanId: null,
          subscriptionEndsAt: trialEndsAt(),
          members: {
            create: { userId: user.id, role: 'landlord_admin' },
          },
        },
        select: { id: true },
      })
      await provisionOrgFromMaster(tx, org.id)
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Registration failed. Please try again.'
    return { error: msg }
  }

  redirect('/auth/signin?registered=1')
}
