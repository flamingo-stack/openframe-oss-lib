/**
 * Mingo in the example: the OpenFrame AI agent service's chat loop (openframe-saas-tenant `openframe-saas-ai-agent`),
 * ported to Node so the example talks to the hub the way production Mingo does: ONLY over the hub's MCP server.
 *
 *   browser ──POST /agent/mingo/chat──▶ this handler ──Anthropic (model loop)
 *                                                    └─▶ hub /api/mcp (tools, slash prompts, answer rules)
 *
 * The browser's chat posts its usual request body and reads the usual UI message stream back (the lib's own writer),
 * so `<EmbeddableChat>` draws Mingo's turns exactly as it draws the hub's.
 *
 * Deliberately NOT ported: the AI service's own tools (devices, scripts, Fleet, tickets…; they need a tenant), write
 * tools with their approval step, and its ~20 system prompt rules (Java constants in `SystemPromptProvider`; a copy
 * would drift). Conversations live in this process's memory only.
 */
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { UI_MESSAGE_STREAM_HEADERS, createUiMessageWriter } from '@flamingo-stack/openframe-frontend-core/chat-protocol'
import { answerRules, modelResponse, modelTools, openHub, resultText } from './agent-mcp.mjs'
import { MINGO_CHAT_PATH } from './agent-path.mjs'
import {
  commandMessage,
  commandUnavailable,
  findPrompt,
  listSlashPrompts,
  parseSlash,
  promptArguments,
  promptInstructions,
} from './agent-slash.mjs'


/** The AI service's settings (configs/prod + base `openframe-saas-ai-agent.yml`). */
const DEFAULT_MODEL = 'claude-opus-5-5'
const MAX_TOKENS = 16192
const MAX_TOOL_CALLS = 50
const MEMORY_MESSAGES = 300

/** Who Mingo is. The AI service's full prompt is not copied (see the module note); this is its first line. */
const SYSTEM_PROMPT =
  "You are Mingo, OpenFrame's AI assistant for MSP technicians and admins. Your OpenFrame AI agent slug is `mingo`. " +
  'Never identify as Claude or Anthropic. Answer from what your tools return; when a tool result carries ' +
  '`_openframeAnswerRules`, follow its rules and its reminder.'

/** Conversation id → Anthropic messages (the AI service keeps a message window per dialog). */
const conversations = new Map()

/** `true` when the request was Mingo's and has been answered. */
export async function handleMingoRequest(req, res, env) {
  const path = (req.url ?? '').split('?')[0]
  if (path !== MINGO_CHAT_PATH) return false
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' }).end()
    return true
  }
  // The key the AI service holds (`HUB_MCP_API_KEY`, the same name), else the browser's own from /debug. The user is
  // the browser's act-as email when it sent one; a personal key with none acts as its owner.
  const authorization = env.HUB_MCP_API_KEY ? `Bearer ${env.HUB_MCP_API_KEY}` : req.headers.authorization
  if (!authorization) {
    sendJson(res, 401, {
      error: "Set HUB_MCP_API_KEY in the example's .env, or paste a platform API key on the /debug page.",
      code: 'NO_CREDENTIALS',
    })
    return true
  }
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    sendJson(res, 503, { error: "Set ANTHROPIC_API_KEY in the example's .env to run Mingo.", code: 'NO_MODEL_KEY' })
    return true
  }
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    sendJson(res, 400, { error: 'The request body is not JSON.', code: 'BAD_REQUEST' })
    return true
  }
  const question = (body.messages ?? []).filter((m) => m.role === 'user').at(-1)
  const text = (question?.parts ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('\n').trim()
  if (!text) {
    sendJson(res, 400, { error: 'The message has no text.', code: 'BAD_REQUEST' })
    return true
  }

  const conversationId = typeof body.id === 'string' && conversations.has(body.id) ? body.id : randomUUID()
  res.writeHead(200, UI_MESSAGE_STREAM_HEADERS)
  const writer = createUiMessageWriter((bytes) => res.write(bytes))
  writer.write({ type: 'start', messageId: randomUUID(), messageMetadata: { conversationId } })
  let hub
  try {
    hub = await openHub(env.HUB_ORIGIN || 'http://localhost:3000', {
      authorization,
      actAs: req.headers['x-chat-act-as'],
    })
    await runTurn({ writer, hub, anthropic: new Anthropic({ apiKey }), model: env.MINGO_MODEL || DEFAULT_MODEL, conversationId, text })
    writer.write({ type: 'finish', finishReason: 'stop', messageMetadata: { conversationId } })
  } catch (err) {
    console.error('[mingo] turn failed:', err)
    writer.write({ type: 'error', errorText: err instanceof Error ? err.message : String(err) })
  } finally {
    writer.close()
    res.end()
    hub?.close().catch(() => {})
  }
  return true
}

async function runTurn({ writer, hub, anthropic, model, conversationId, text }) {
  const history = conversations.get(conversationId) ?? []
  const { tools, titles } = await modelTools(hub)
  const rules = await answerRules(hub)

  // A slash command becomes its MCP prompt's instructions (`SlashCommandMessageHandler`).
  let userText = text
  let forced = null
  const slash = parseSlash(text)
  if (slash) {
    const prompt = findPrompt(await listSlashPrompts(hub), slash.name)
    const runnable =
      prompt &&
      (prompt.executionMode === 'delegate_to_assistant' ||
        (prompt.executionMode === 'force_tool' && tools.some((t) => t.name === prompt.toolName)))
    if (!runnable) {
      writeText(writer, commandUnavailable(slash.name))
      return
    }
    const args = promptArguments(prompt, slash.argument)
    userText = commandMessage(await promptInstructions(hub, prompt, args), text)
    if (prompt.executionMode === 'force_tool') forced = { toolName: prompt.toolName, direct: prompt.responseMode === 'direct' }
  }

  const messages = [...history, { role: 'user', content: userText }]
  let toolCalls = 0
  let round = 0
  for (;;) {
    const forcing = forced && round === 0
    const response = await streamRound({ writer, anthropic, model, messages, tools, forcing: forcing ? forced.toolName : null })
    messages.push({ role: 'assistant', content: response.content })
    const calls = response.content.filter((b) => b.type === 'tool_use')
    if (calls.length === 0 || response.stop_reason !== 'tool_use') break

    const results = []
    for (const call of calls) {
      toolCalls += 1
      writer.write({
        type: 'tool-input-available',
        toolCallId: call.id,
        toolName: call.name,
        title: titles.get(call.name) ?? call.name,
        input: call.input,
        dynamic: true,
      })
      if (toolCalls > MAX_TOOL_CALLS) {
        const errorText = `Stopped: more than ${MAX_TOOL_CALLS} tool calls in one turn.`
        writer.write({ type: 'tool-output-error', toolCallId: call.id, errorText, dynamic: true })
        results.push({ type: 'tool_result', tool_use_id: call.id, content: errorText, is_error: true })
        continue
      }
      const result = await hub.callTool({ name: call.name, arguments: call.input ?? {} })
      const forModel = modelResponse(call.name, result, rules)
      if (result.isError) writer.write({ type: 'tool-output-error', toolCallId: call.id, errorText: resultText(result), dynamic: true })
      else writer.write({ type: 'tool-output-available', toolCallId: call.id, output: result.structuredContent ?? forModel, dynamic: true })
      results.push({ type: 'tool_result', tool_use_id: call.id, content: forModel, ...(result.isError ? { is_error: true } : {}) })

      // A command the hub marks `responseMode: direct` ends the turn on its tool's result, unchanged (the AI
      // service's `McpResponseMode.DIRECT`): `/what-can-you-do`'s quick actions are drawn as chips.
      if (forcing && forced.direct && call.name === forced.toolName && !result.isError) {
        writeDirectAnswer(writer, result)
        messages.push({ role: 'user', content: results })
        messages.push({ role: 'assistant', content: [{ type: 'text', text: resultText(result) || 'Done.' }] })
        conversations.set(conversationId, messages.slice(-MEMORY_MESSAGES))
        return
      }
    }
    messages.push({ role: 'user', content: results })
    if (toolCalls > MAX_TOOL_CALLS) break
    round += 1
  }
  conversations.set(conversationId, messages.slice(-MEMORY_MESSAGES))
}

/**
 * One model call, streamed (`AnthropicChatModelProvider`): adaptive thinking at medium effort, the system prompt and
 * tools cached. A forced round offers only the forced tool.
 */
async function streamRound({ writer, anthropic, model, messages, tools, forcing }) {
  const roundTools = forcing ? tools.filter((t) => t.name === forcing) : tools
  const cachedTools = roundTools.map((t, i) => (i === roundTools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t))
  const stream = anthropic.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: cachedTools,
    messages,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    // The models the AI service runs think on every call, and a forced tool choice cannot be combined with thinking,
    // so a forced round offers ONLY the forced tool and lets the model call it (`ForcedToolChatRequestTransformer`
    // does the same for a model whose forced tool use is off).
    ...(forcing ? { tool_choice: { type: 'auto' } } : {}),
  })
  let textId = null
  stream.on('text', (delta) => {
    if (!textId) {
      textId = randomUUID()
      writer.write({ type: 'text-start', id: textId })
    }
    writer.write({ type: 'text-delta', id: textId, delta })
  })
  const message = await stream.finalMessage()
  if (textId) writer.write({ type: 'text-end', id: textId })
  return message
}

/** A direct result as the chat draws it: its line of text, then its quick actions as chips. */
function writeDirectAnswer(writer, result) {
  const data = result.structuredContent
  if (!data || !Array.isArray(data.groups)) {
    writeText(writer, resultText(result))
    return
  }
  if (data.text) writeText(writer, data.text)
  writer.write({
    type: 'data-suggestions',
    data: {
      groups: data.groups.map((g) => ({
        label: g.label,
        prompts: (g.prompts ?? []).map((p) => {
          // The hub's standard MCP icons: the light one is drawn on the chat's dark surface.
          const icon = (p.icons ?? []).find((i) => i.theme === 'light') ?? p.icons?.[0]
          return { label: p.label, ...(p.prompt ? { prompt: p.prompt } : {}), ...(icon ? { icon: { url: icon.src } } : {}) }
        }),
      })),
      ...(data.note ? { note: data.note } : {}),
    },
  })
}

function writeText(writer, text) {
  if (!text) return
  const id = randomUUID()
  writer.write({ type: 'text-start', id })
  writer.write({ type: 'text-delta', id, delta: text })
  writer.write({ type: 'text-end', id })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
}
