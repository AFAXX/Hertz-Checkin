import { NextRequest, NextResponse } from 'next/server'
import { autoArchiveExpiredContracts } from '../../contracts/route'

/**
 * Vercel Cron Job endpoint — invoked daily by Vercel's cron scheduler.
 * See vercel.json for the schedule (runs at 02:00 and 03:00 UTC to cover
 * both CET (UTC+1) and CEST (UTC+2) — i.e. 04:00 Malta time year-round).
 *
 * Authentication: Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`
 * on every cron invocation. We verify it matches the env var. If CRON_SECRET is
 * not set in the env, we fall back to requiring an admin session (for manual
 * triggering from the dashboard).
 *
 * The underlying autoArchiveExpiredContracts() is idempotent — running it
 * multiple times per day produces the same result. Safe to invoke on every
 * admin page load AND via cron.
 */
export async function GET(request: NextRequest) {
  // 1) Try CRON_SECRET auth (preferred — Vercel cron)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const hasValidCronSecret = !!(cronSecret && authHeader === `Bearer ${cronSecret}`)

  // 2) Fall back to admin session (manual trigger from a logged-in admin)
  let hasAdminSession = false
  if (!hasValidCronSecret) {
    try {
      const { getServerSession } = await import('next-auth')
      const { authOptions } = await import('@/lib/auth')
      const session = await getServerSession(authOptions)
      hasAdminSession = !!session
    } catch {
      hasAdminSession = false
    }
  }

  if (!hasValidCronSecret && !hasAdminSession) {
    return NextResponse.json(
      { error: 'Unauthorized — provide a valid CRON_SECRET bearer token or admin session.' },
      { status: 401 }
    )
  }

  try {
    const result = await autoArchiveExpiredContracts()
    console.log('[cron/auto-archive] result:', result)
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('[cron/auto-archive] failed:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Auto-archive failed: ${msg}` },
      { status: 500 }
    )
  }
}

export const maxDuration = 30
