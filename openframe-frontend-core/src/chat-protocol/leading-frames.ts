/**
 * Leading-frame → `ChatStreamEvent` table — the ONE mapping both transports read.
 *
 * The SSE decoder (`./decode.ts`) reaches it while walking the hub's byte
 * framing. The NATS decoder (`./nats-decoder.ts`) reaches it for `GUIDE` chunks
 * carrying a `payload`: the saas-ai-agent re-streams the Product Guide's hub
 * frames VERBATIM into the Mingo chunk stream (`GuideStreamingService`), so the
 * bytes a guide answer is made of are the same frames on both transports — only
 * the envelope differs. Decoding them twice would drift the moment the hub adds
 * a frame kind, which is why this table lives outside either decoder.
 *
 * The NATS side does NOT take every event this table can produce; see
 * `guideFrameEvent` in `./nats-decoder.ts` for which ones cross over and why.
 *
 * Server-safe: no React, no browser APIs.
 */

import type { ChatStreamEvent } from './events'

/**
 * Escape `<` so markdown renderers that pass HTML through (rehypeRaw)
 * don't treat XML-like tokens in Claude's thinking output as elements.
 * `<` → `&lt;` preserves the visible character without breaking
 * blockquote `>` markers. Per-character, so it distributes over
 * concatenation: escape(a + b) === escape(a) + escape(b) — callers may
 * apply it per-delta or on the accumulated string interchangeably.
 */
export function escapeThinkingTags(text: string): string {
  return text.replace(/</g, '&lt;')
}

/**
 * Map one parsed leading frame to normalized events, replicating the
 * legacy parser's else-if chain ORDER and its exact truthiness/typeof
 * gates. Frames that matched a branch but failed its inner validation
 * (e.g. `routing` without a string `routedComplexity`) produce NO event,
 * exactly like the legacy no-op.
 *
 * Every branch pushes AT MOST ONE event — `guideFrameEvent` relies on that
 * to hand a single event back to `decodeNatsChunk`'s per-chunk contract.
 */
export function mapLeadingFrame(meta: any, out: ChatStreamEvent[]): void {
  if (meta.status === 'thinking') {
    out.push({ type: 'status', phase: 'thinking' })
  } else if (meta.kind === 'thinking-delta' && typeof meta.text === 'string') {
    // Wire is ALREADY delta — emit verbatim, append-only contract.
    out.push({ type: 'thinking-delta', text: meta.text })
  } else if (meta.kind === 'usage' && meta.stage === 'start') {
    out.push({
      type: 'usage',
      stage: 'start',
      input_tokens: meta.input_tokens,
      cache_read_input_tokens: meta.cache_read_input_tokens,
      cache_creation_input_tokens: meta.cache_creation_input_tokens,
    })
  } else if (meta.kind === 'decision_resolved' && typeof meta.action === 'string') {
    const status = meta.action === 'rejected' ? 'rejected' : 'approved'
    const toolName = typeof meta.tool_name === 'string' ? meta.tool_name : undefined
    const result = meta.result ?? null
    const card = meta.card ?? null
    out.push({
      type: 'approval-resolved',
      status,
      ok: meta.ok === true,
      willAutoContinue: meta.willAutoContinue === true,
      ...(toolName ? { toolName } : {}),
      ...(result ? { result } : {}),
      ...(card?.marker ? { marker: card.marker } : {}),
      ...(card?.ref ? { cardRef: card.ref } : {}),
      ...(card?.type ? { cardType: card.type } : {}),
      ...(typeof meta.receiptText === 'string' ? { receiptText: meta.receiptText } : {}),
      requestId: typeof meta.proposalId === 'string' ? meta.proposalId : undefined,
    })
  } else if (meta.kind === 'approval_batch' && meta.batchId && Array.isArray(meta.proposals)) {
    // Server-grouped multi-proposal turn → ONE batch event carrying a
    // tool-call row per proposal. `toolExecutionRequestId` is the row's
    // PROPOSAL id (each row resolves through its own per-proposal
    // confirm); the batch's `requestId` is the stable anchor the shell
    // uses for status flips. Field rows ride as the row's expandable
    // args so per-proposal detail stays reachable inside the batch.
    const toolCalls = (meta.proposals as Array<Record<string, any>>)
      .filter((p) => p && typeof p.proposalId === 'string')
      .map((p) => {
        const rawFields = Array.isArray(p.fields)
          ? (p.fields as Array<{ label?: string; value?: string }>).filter(
              (f) => f && f.label && f.value,
            )
          : []
        // Prefer human-readable identity labels for the row's
        // disambiguator; opaque-id labels ("Task", "Ticket") only as
        // the last-resort first field.
        const detail =
          rawFields.find((f) => /^(title|subject|name)$/i.test(String(f.label))) ??
          rawFields[0]
        const base =
          typeof p.title === 'string' && p.title.length > 0 ? p.title : String(p.toolName ?? 'Tool call')
        return {
          toolExecutionRequestId: String(p.proposalId),
          toolName: String(p.toolName ?? 'tool'),
          toolTitle: detail ? `${base} — ${detail.value}` : base,
          requiresApproval: true,
          toolCallArguments:
            rawFields.length > 0
              ? Object.fromEntries(rawFields.map((f) => [String(f.label), String(f.value)]))
              : null,
        }
      })
    if (toolCalls.length > 0) {
      out.push({
        type: 'approval-request',
        requestId: String(meta.batchId),
        approvalType: 'chat',
        toolCalls,
        status: 'pending',
      })
    }
  } else if (meta.kind === 'approval_request' && meta.proposalId) {
    const proposalId = String(meta.proposalId)
    const toolName = String(meta.toolName ?? 'tool')
    const headline =
      typeof meta.title === 'string' && meta.title.length > 0 ? meta.title : toolName
    const rawFields = Array.isArray(meta.fields)
      ? (meta.fields as Array<{ label?: string; value?: string }>)
      : []
    const fields: Array<{ label: string; value: string }> = []
    for (const f of rawFields) {
      if (!f || !f.label || !f.value) continue
      fields.push({ label: f.label, value: f.value })
    }
    out.push({
      type: 'approval-request',
      requestId: proposalId,
      approvalType: toolName,
      command: headline,
      fields,
      status: 'pending',
    })
  } else if (meta.kind === 'text-leading' && typeof meta.text === 'string') {
    out.push({ type: 'text-delta', text: meta.text, leading: true })
  } else if (meta.kind === 'tool_error') {
    const msg =
      typeof meta.message === 'string' && meta.message.length > 0
        ? meta.message
        : 'Could not complete the requested action right now.'
    out.push({ type: 'error', title: msg })
  } else if (meta.kind === 'routing') {
    if (typeof meta.routedComplexity === 'string') {
      out.push({
        type: 'metadata',
        routing: {
          routedComplexity: meta.routedComplexity,
          ...(typeof meta.routedModel === 'string' ? { routedModel: meta.routedModel } : {}),
          routedThinkingBudget:
            typeof meta.routedThinkingBudget === 'number' ? meta.routedThinkingBudget : null,
        },
      })
    }
  } else {
    // Catch-all metadata-ish frame. Raw values pass through UNVALIDATED
    // (possibly undefined) so the consumer can replicate the legacy
    // presence/truthiness gates exactly — including the `model`-presence
    // trigger whose value is never stored.
    out.push({
      type: 'metadata',
      sources: meta.sources,
      refs: meta.refs,
      provider: meta.provider,
      modelLabel: meta.modelLabel,
      modelName: meta.model,
      contextWindowMaxTokens: meta.contextWindowMaxTokens,
      scrollAnchor: meta.scrollAnchor,
      conversationId: meta.conversationId,
    })
  }
}
