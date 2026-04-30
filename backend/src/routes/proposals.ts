import { Router, type Request, type Response } from 'express'
import {
  approveProposal,
  castProposalVote,
  createProposal,
  createProposalReport,
  executeMergeProposal,
  getProposalDetail,
  listAdminQueue,
  listProposalFeed,
  listProposalReviewFeed,
  listProposalReports,
  listUserProposals,
  proposalsEnabled,
  rejectProposal,
  requireAdminUser,
  revertProposal,
} from '../lib/proposals.js'
import { banUser, unbanUser } from '../lib/ban.js'

const router = Router()

function headerUserId(req: Request): string | null {
  const userId = req.headers['x-user-id']
  return typeof userId === 'string' && userId.trim() ? userId.trim() : null
}

function respondError(res: Response, error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  return res.status(status).json({ error: message })
}

router.use((req, res, next) => {
  if (!proposalsEnabled()) {
    return res.status(404).json({ error: 'Proposal system is disabled' })
  }
  next()
})

router.post('/proposals', async (req, res) => {
  const proposerId = headerUserId(req)
  if (!proposerId) {
    return res.status(401).json({ error: 'You must be logged in to submit a proposal' })
  }

  try {
    const result = await createProposal({
      proposerId,
      type: req.body.type,
      reason: String(req.body.reason ?? ''),
      payload: req.body.payload,
      targetSongId: typeof req.body.target_song_id === 'string' ? req.body.target_song_id : null,
      canonicalSongId: typeof req.body.canonical_song_id === 'string' ? req.body.canonical_song_id : null,
      ignoreMatches: Boolean(req.body.ignore_matches),
    })

    if (result.needsConfirmation) {
      return res.status(409).json({
        error: 'Possible duplicate matches found',
        candidateMatches: result.candidateMatches,
        needsConfirmation: true,
      })
    }

    return res.status(201).json(result)
  } catch (error) {
    return respondError(res, error)
  }
})

router.get('/proposals', async (req, res) => {
  try {
    const proposals = await listProposalFeed(
      {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
      },
      headerUserId(req),
    )
    return res.json(proposals)
  } catch (error) {
    return respondError(res, error)
  }
})

router.get('/proposals/review-feed', async (req, res) => {
  try {
    const feed = await listProposalReviewFeed(
      {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
      },
      headerUserId(req),
      {
        limit: typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined,
        offset: typeof req.query.offset === 'string' ? Number.parseInt(req.query.offset, 10) : undefined,
      },
    )
    return res.json(feed)
  } catch (error) {
    return respondError(res, error)
  }
})

router.get('/users/:id/proposals', async (req, res) => {
  try {
    const viewerId = headerUserId(req)
    const proposals = await listUserProposals(req.params.id, viewerId)
    return res.json(proposals)
  } catch (error) {
    return respondError(res, error)
  }
})

router.get('/proposals/:id', async (req, res) => {
  try {
    const proposal = await getProposalDetail(req.params.id, headerUserId(req))
    return res.json(proposal)
  } catch (error) {
    return respondError(res, error, 404)
  }
})

router.post('/proposals/:id/vote', async (req, res) => {
  const userId = headerUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'You must be logged in to vote' })
  }

  const value = Number(req.body.value)
  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'Votes must be 1 or -1' })
  }

  try {
    const proposal = await castProposalVote(req.params.id, userId, value, {
      reason: typeof req.body.reason === 'string' ? req.body.reason : null,
      reasonCode: typeof req.body.reason_code === 'string' ? req.body.reason_code as any : null,
    })
    return res.json(proposal)
  } catch (error) {
    return respondError(res, error)
  }
})

router.post('/proposals/:id/report', async (req, res) => {
  const reporterId = headerUserId(req)
  if (!reporterId) {
    return res.status(401).json({ error: 'You must be logged in to report a proposal' })
  }

  try {
    const report = await createProposalReport({
      proposalId: req.params.id,
      reporterId,
      category: String(req.body.category ?? 'other'),
      details: String(req.body.details ?? ''),
    })
    return res.status(201).json(report)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('limit') ? 429 : 400
    return respondError(res, error, status)
  }
})

router.get('/admin/queue', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)
    const queue = await listAdminQueue(
      {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        reporterState: typeof req.query.reporterState === 'string' ? req.query.reporterState : undefined,
      },
      adminId,
    )
    return res.json(queue)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

router.get('/admin/reports', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)
    const reports = await listProposalReports(typeof req.query.status === 'string' ? req.query.status : undefined)
    return res.json(reports)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

router.post('/admin/users/:id/ban', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)

    const endTime = typeof req.body.end_time === 'string' && req.body.end_time.trim() ? new Date(req.body.end_time).toISOString() : null
    const durationMinutes = typeof req.body.duration_minutes === 'number'
      ? req.body.duration_minutes
      : typeof req.body.duration_minutes === 'string'
      ? Number.parseInt(req.body.duration_minutes, 10)
      : null

    if (!endTime && (!durationMinutes || Number.isNaN(durationMinutes) || durationMinutes <= 0)) {
      return res.status(400).json({ error: 'Missing ban duration or valid end time' })
    }

    const ban = await banUser(req.params.id, { endTime: endTime ?? undefined, durationMinutes: durationMinutes ?? undefined })
    return res.status(201).json(ban)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

router.delete('/admin/users/:id/ban', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)
    await unbanUser(req.params.id)
    return res.json({ success: true })
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

router.post('/admin/proposals/:id/approve', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)
    const proposal = await approveProposal(req.params.id, adminId, String(req.body.reason ?? 'Approved by admin'))
    return res.json(proposal)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

router.post('/admin/proposals/:id/reject', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)
    const proposal = await rejectProposal(req.params.id, adminId, String(req.body.reason ?? 'Rejected by admin'))
    return res.json(proposal)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

router.post('/admin/proposals/:id/merge', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)
    const proposal = await executeMergeProposal(req.params.id, adminId, String(req.body.reason ?? 'Merged by admin'))
    return res.json(proposal)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

router.post('/admin/proposals/:id/revert', async (req, res) => {
  const adminId = headerUserId(req)
  if (!adminId) {
    return res.status(401).json({ error: 'You must be logged in' })
  }

  try {
    await requireAdminUser(adminId)
    const proposal = await revertProposal(req.params.id, adminId, String(req.body.reason ?? 'Reverted by admin'))
    return res.json(proposal)
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Admin') ? 403 : 400
    return respondError(res, error, status)
  }
})

export default router