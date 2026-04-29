# Proposal System

## Scope

This rollout adds a staged contribution workflow for songs:

- `song_add` proposals from the add-song page.
- `song_edit` proposals from the song page pen action.
- `song_merge` proposals from the song page merge action.
- Weighted voting, reporting, admin queue handling, merge execution, and revert support.

The live catalog is not mutated directly when proposals are enabled. Changes stay pending until weighted approval or an admin action applies them.

## Feature Flags

Backend:

- `ENABLE_PROPOSALS=true`
- `PROPOSAL_AUTO_APPROVE_THRESHOLD=6`
- `PROPOSAL_AUTO_REJECT_THRESHOLD=4`
- `PROPOSAL_SPOTIFY_WEIGHT_MULTIPLIER=0.5`
- `PROPOSAL_MAX_VOTE_WEIGHT=5`
- `PROPOSAL_APPROVAL_REPUTATION_DELTA=2`
- `PROPOSAL_REJECTION_REPUTATION_DELTA=-1`
- `PROPOSAL_HIGH_CONFIDENCE_MATCH=0.82`
- `PROPOSAL_REPORTS_PER_DAY=5`

Frontend:

- `VITE_ENABLE_PROPOSALS=true`

When the frontend flag is disabled, the existing direct-add and owner-edit flow remains visible.

## API Summary

- `POST /api/proposals`
- `GET /api/proposals`
- `GET /api/users/:id/proposals`
- `GET /api/proposals/:id`
- `POST /api/proposals/:id/vote`
- `POST /api/proposals/:id/report`
- `GET /api/admin/queue`
- `GET /api/admin/reports`
- `POST /api/admin/proposals/:id/approve`
- `POST /api/admin/proposals/:id/reject`
- `POST /api/admin/proposals/:id/merge`
- `POST /api/admin/proposals/:id/revert`

The backend service layer handles duplicate detection, vote weighting, reputation adjustments, report rate limits, and calls the SQL RPCs for approve/merge/revert.

## Rollout Plan

1. Apply `supabase/proposals_migration.sql` in a staging database.
2. Backfill `songs.spotify_import` where Spotify metadata already exists.
3. Grant internal accounts access via `user_privileges`.
   Level `1` = admin, level `2` = owner.
   Example:
   `insert into user_privileges (user_id, privilege_level, notes) values ('<uuid>', 1, 'internal moderator');`
4. Turn on `ENABLE_PROPOSALS` and `VITE_ENABLE_PROPOSALS` only for internal beta.
5. Validate the happy paths:
   - Suggest song with duplicate warning.
   - Suggest edit from a song page.
   - Vote from Contributions.
   - Admin approve a song add/edit.
   - Admin execute a merge.
   - Admin revert an approved contribution.
6. Monitor queue volume, weighted auto-approvals, report rate, and revert incidents.
7. Roll out broadly after thresholds and moderation load look stable.

## Admin Runbook

- Use `/admin/proposals` to review pending proposals and reports.
- Reject anything malformed instead of editing live data directly.
- Use merge execution only after the canonical record is clear.
- Reverts should include a reason because reputation reversal is coupled to the proposal record.
- If the queue backs up, temporarily raise admin staffing before loosening thresholds.

## Known Gaps

- Project-wide frontend build currently fails before app code due to the existing `ignoreDeprecations` value in `frontend/tsconfig.json`.
- Tests were intentionally deferred in this pass.
- Merge proposals currently optimize for one canonical plus a selected duplicate in the UI, while the backend and schema support the broader multi-song shape.