---
name: realtime-chat-review
description: Extra review angles for the NATS/JetStream realtime chat pipeline (chunk processors, accumulators, adapters, consumer stores). Use IN ADDITION to /code-review whenever a diff touches src/components/chat/**, src/nats/**, or any consumer copy of the chat pipeline.
---

# Realtime chat pipeline review

Line-level review misses the dominant bug class in this code: **event-sequence
bugs** — every line is individually correct, but a specific ordering of events
over time corrupts state. Run the standard /code-review angles, PLUS the two
angles below as additional finders, and give their candidates equal rank with
correctness findings.

## Domain invariants (presume these; do not treat them as "speculative")

- **JetStream is at-least-once.** Any chunk can be redelivered after later
  chunks were already applied. Every message/segment updater MUST be
  idempotent and must never downgrade state (EXECUTED → EXECUTING, resolved
  approval → pending, completed compaction → started).
- **CHAT_CHUNKS retention is 10 minutes.** A reconnect after a gap cannot be
  healed from the stream alone — history refetch is mandatory; missing it is
  a bug, not an edge case.
- **Sequence spaces are per (dialogId, chatType).** CLIENT_CHAT and
  ADMIN_AI_CHAT counters are independent; a single scalar checkpoint or
  seen-set shared across types is a bug.
- **Post-MESSAGE_END chunks are normal**, not exceptional: approved-command
  executions, retries after errors, and catchup replay all deliver tool and
  approval chunks outside the START…END window. "Update-existing-only"
  updaters silently drop the first such chunk.
- **SYSTEM / DIRECT_MESSAGE are instant types** — never stored in the chunk
  store, recoverable only from Mongo history.

## Angle I — event-sequence adversary

For EVERY handler, updater, and effect the diff touches, enumerate these
adversarial timelines and check each one produces correct state:

1. **Duplicate delivery** — the same chunk applied twice, including after a
   later chunk already advanced the state (no-downgrade, no duplicate cards).
2. **Reorder** — chunk N+1 before chunk N across a resubscribe boundary.
3. **Stale context** — the async operation (fetch, catchup, history load)
   resolves AFTER the user switched dialogs: does its completion/finally
   block touch the NEW dialog's state (flags, buffers, checkpoints, queues)?
   Is every queued continuation scoped to its originating dialogId?
4. **Double trigger** — the same lifecycle event fires twice in a row
   (reconnect during reconnect handling, two rapid MESSAGE_ENDs, effect
   re-run under StrictMode): are buffer-arming and reset paths idempotent?
5. **Replay after completion** — catchup re-emits chunks for an already
   rendered message: do upserts key on stable ids (approvalRequestId,
   toolExecutionRequestId, streamSeq) rather than blind append?
6. **Cross-type interleaving** — CLIENT_CHAT and ADMIN_AI_CHAT streams
   interleave on one dialog: are checkpoints, START/END windows, and
   seen-sets keyed per messageType?

A candidate from this angle is reportable when you can write the concrete
timeline (event 1 → event 2 → event 3 → wrong state). Do not discard it as
"depends on runtime timing" — for this transport, that timing is guaranteed
to occur.

## Angle J — parallel-path consistency

The pipeline is intentionally copy-adapted in four places. For every behavior
the diff changes in one copy, diff it against the other three AND against the
history path:

| Copy | Location |
|------|----------|
| Lib adapter | `openframe-frontend-core/src/components/chat/hooks/use-nats-chat-adapter.ts` (+ `use-chunk-catchup`, `use-realtime-chunk-processor`, `message-segment-accumulator`) |
| Admin tickets | `openframe-frontend/src/app/(app)/tickets/` (store + `use-side-chunk-processor`) |
| Admin mingo | `openframe-frontend/src/app/(app)/mingo/` (store + realtime subscription) |
| Tauri client | `openframe-oss-tenant/clients/openframe-chat/src/hooks/` (`useChatMessages`, `useChat`) |

And the paired paths inside each copy:

- realtime processing vs `process-historical-messages` (defaults MUST match:
  `displayApprovalTypes`, `batchApprovalsEnabled`, segment shapes);
- live subscription vs catchup replay (same dedup keys, same boundaries);
- standalone `tool_execution` segment vs `approval_batch.executions[execId]`
  slot (guards added to one MUST exist in the other).

Report any copy where a guard, default, dedup key, scan direction, or
fallback added by the diff is absent or differs — that asymmetry IS the
finding, even if the lagging copy "works today".

## Verification guidance

When verifying candidates from these angles, redelivery/reorder/stale-context
timelines are PLAUSIBLE by default (the transport guarantees them). REFUTED
requires citing an existing guard in the code that covers the exact timeline.
