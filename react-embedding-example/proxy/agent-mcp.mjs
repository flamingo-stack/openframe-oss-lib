/**
 * Mingo's connection to the hub: the hub's MCP server, used the way the OpenFrame AI agent service
 * (openframe-saas-tenant `openframe-saas-ai-agent`) uses it. Each rule below names the Java class it mirrors.
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

/** Tools the assistant never sees (`HubMcpToolPolicy`): the hub's own answering loop, approvals, card hydration. */
const HIDDEN_TOOLS = new Set(['ask_guide', 'confirm_proposal', 'get_entity_cards'])
/** Tools that must be read-only, or the hub's catalog is refused (`HubMcpToolPolicy`). */
const REQUIRED_READ_ONLY = ['search_docs', 'retrieve_docs']
/** Results given the hub's answer rules (`HubMcpServerClient.CONTENT_TOOLS`). */
const CONTENT_TOOLS = new Set(['search_docs', 'retrieve_docs'])
const ANSWER_RULES_URI = 'hub://answer-rules'
const ANSWER_RULES_FIELD = '_openframeAnswerRules'

/**
 * One MCP client for one user, as `HubMcpRequestHeaders` sends them: the platform key, and the user the call is made
 * for. Here both are the browser's own (the /debug page), forwarded by the example's server.
 */
export async function openHub(hubOrigin, { authorization, actAs }) {
  const client = new Client({ name: 'react-embedding-example-mingo', version: '1.0.0' })
  const headers = { Authorization: authorization, ...(actAs ? { 'X-Chat-Act-As': actAs } : {}) }
  await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp', hubOrigin), { requestInit: { headers } }))
  return client
}

/**
 * The tools the model is given (`HubMcpToolPolicy`, `McpToolValidator`), and what the chat's tool row calls each (the
 * hub's own title). Write tools are left out: the AI service asks an admin to approve each one, and the example has
 * no approval step.
 */
export async function modelTools(client) {
  const { tools } = await client.listTools()
  for (const name of REQUIRED_READ_ONLY) {
    const tool = tools.find((t) => t.name === name)
    if (tool?.annotations?.readOnlyHint !== true) {
      throw new Error(`The hub's ${name} is not read-only; its tool catalog is refused.`)
    }
  }
  const offered = tools.filter((t) => !HIDDEN_TOOLS.has(t.name) && t.annotations?.readOnlyHint === true)
  return {
    tools: offered.map((t) => ({ name: t.name, description: t.description ?? '', input_schema: withoutApproved(t.inputSchema) })),
    titles: new Map(offered.map((t) => [t.name, t.title ?? t.annotations?.title ?? t.name])),
  }
}

function withoutApproved(schema) {
  if (!schema?.properties?.approved) return schema
  const { approved: _approved, ...properties } = schema.properties
  return { ...schema, properties, required: (schema.required ?? []).filter((n) => n !== 'approved') }
}

/** The hub's answer rules (`HubMcpAnswerRulesSource`): read once a minute, as the AI service caches them. */
let rulesCache = { at: 0, value: null }
export async function answerRules(client) {
  if (rulesCache.value && Date.now() - rulesCache.at < 60_000) return rulesCache.value
  try {
    const { contents } = await client.readResource({ uri: ANSWER_RULES_URI })
    const body = JSON.parse(contents?.[0]?.text ?? '{}')
    const rules = (body.rules ?? []).map((r) => r.text).filter(Boolean)
    if (!rules.length || !body.reminder) throw new Error('the answer rules lack their rules or reminder')
    rulesCache = { at: Date.now(), value: { rules, reminder: body.reminder } }
    return rulesCache.value
  } catch (err) {
    console.warn(`[mingo] hub answer rules unavailable, results passed without them: ${err.message}`)
    return null
  }
}

/** A tool result's text content: what the model reads (`HubMcpToolService`). */
export function resultText(result) {
  return (result.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
}

/**
 * What the model reads of a hub result (`HubMcpServerClient.toModelResponse`): `search_docs` loses its discovery
 * previews (`HubMcpSearchResponseMapper`), and the docs tools carry the hub's answer rules
 * (`HubMcpAnswerRulesReminder`).
 */
export function modelResponse(toolName, result, rules) {
  const text = resultText(result)
  if (!CONTENT_TOOLS.has(toolName) || result.isError) return text
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return text
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return text
  if (toolName === 'search_docs' && Array.isArray(body.results)) {
    body.results = body.results.map((r) => {
      if (!r || typeof r !== 'object') return r
      const { preview: _preview, ...rest } = r
      return rest
    })
  }
  if (rules) body[ANSWER_RULES_FIELD] = { rules: rules.rules, reminder: rules.reminder }
  return JSON.stringify(body)
}
