/**
 * Mingo's slash commands: the hub's MCP prompts, run the way the OpenFrame AI agent service runs them
 * (`SlashCommandParser`, `McpSlashCommandResolver`, `McpSlashCommandArgumentParser`, `HubMcpPromptPolicy`,
 * `SlashCommandMessageHandler`). Each function names the class it mirrors.
 */

const SLASH_COMMAND_META_KEY = 'ai.openframe/slashCommand'
const SLASH_PATTERN = /^\/([A-Za-z0-9][\w-]*)(?:\s+([\s\S]*))?$/

/** `/word rest` → `{ name, argument }`, or null (`SlashCommandParser`). */
export function parseSlash(text) {
  const match = SLASH_PATTERN.exec(text.trim())
  return match ? { name: match[1], argument: (match[2] ?? '').trim() } : null
}

/** Every prompt, every page (`HubMcpPromptHttpTransport`), with its slash-command metadata. */
export async function listSlashPrompts(client) {
  const prompts = []
  let cursor
  do {
    const page = await client.listPrompts(cursor ? { cursor } : {})
    prompts.push(...page.prompts)
    cursor = page.nextCursor
  } while (cursor)
  return prompts.map((p) => {
    const meta = p._meta?.[SLASH_COMMAND_META_KEY]
    return {
      name: p.name,
      argumentNames: (p.arguments ?? []).map((a) => a.name).filter(Boolean),
      executionMode: typeof meta?.executionMode === 'string' ? meta.executionMode.toLowerCase() : null,
      toolName: meta?.toolName ?? null,
      actions: (meta?.actions ?? []).map((a) => a?.name).filter(Boolean),
      responseMode: typeof meta?.responseMode === 'string' ? meta.responseMode.toLowerCase() : 'context',
    }
  })
}

/** The prompt a command names, ignoring case (`McpSlashCommandResolver`). */
export function findPrompt(prompts, name) {
  const wanted = name.toLowerCase()
  return prompts.find((p) => p.name.toLowerCase() === wanted) ?? null
}

/** The prompt's arguments from the command's text (`McpSlashCommandArgumentParser`). */
export function promptArguments(prompt, rawArgument) {
  const action = commandAction(prompt.actions, rawArgument)
  const args = {}
  for (const name of prompt.argumentNames) {
    let value
    if (name === 'action') value = action.name
    else if (name === 'query') value = action.value
    else if (name === 'input' || name === 'argument') value = rawArgument
    else if (name.endsWith('Ref') && action.name === 'find') value = action.value
    if (value && value.trim()) args[name] = value.trim()
  }
  return args
}

function commandAction(actions, rawArgument) {
  const argument = (rawArgument ?? '').trim()
  const named = (expected) => actions.find((a) => a.toLowerCase() === expected.toLowerCase())?.toLowerCase()
  if (!argument) return { name: named('browse'), value: '' }
  const find = named('find')
  if (find && argument.length >= 2 && argument.startsWith('"') && argument.endsWith('"')) {
    return { name: find, value: argument.slice(1, -1).replace(/\\(.)/g, '$1') }
  }
  const space = argument.indexOf(' ')
  const firstWord = space >= 0 ? argument.slice(0, space) : argument
  const explicit = named(firstWord)
  if (explicit) return { name: explicit, value: space >= 0 ? argument.slice(space + 1).trim() : '' }
  return { name: named('search'), value: argument }
}

/** The prompt's instructions: its text messages joined (`McpPromptResponseMapper`), plus the action rule (`HubMcpPromptPolicy`). */
export async function promptInstructions(client, prompt, args) {
  const { messages } = await client.getPrompt({ name: prompt.name, arguments: args })
  const text = (messages ?? [])
    .flatMap((m) => (Array.isArray(m.content) ? m.content : [m.content]))
    .filter((c) => c?.type === 'text' && c.text)
    .map((c) => c.text)
    .join('\n')
  if (prompt.executionMode !== 'force_tool' || prompt.toolName !== 'search_docs') return text
  const action = args.action ?? ''
  if (['search', 'find', 'display'].includes(action)) {
    return `${text}\n\nSelected slash-command action: ${action}.\nFor this search_docs call, set browse=false. Keep the requested topic or record reference as query;\ndo not replace it with a general/latest-items browse.\nThis selected action takes precedence over generic browsing instructions above.\n`
  }
  if (action === 'browse') {
    return `${text}\n\nSelected slash-command action: browse.\nFor this search_docs call, set browse=true and follow the Hub browsing scope.\n`
  }
  return text
}

/** What the model is sent in place of the command (`SlashCommandMessageHandler`). */
export function commandMessage(instructions, original) {
  return `MCP command instructions:\n${instructions}\n\nOriginal user request:\n${original}\n\nUse the command instructions for lookup scope and arguments. Answer the original user request\nat the requested level of detail: finding documents is not the final answer to a how-to question.\nHub formatting instructions do not override the system card-presentation rules.\nA Hub numbered-list instruction is not a user's request for text without cards.\n`
}

/** The reply when a command cannot be run (`SlashCommandMessageHandler`). */
export function commandUnavailable(name) {
  return `I couldn't run /${name} right now. Try again in a moment, or ask me in your own words.`
}
