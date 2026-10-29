/**
 * How a script execution's status and source are presented: one table, read
 * by the product's Execution History, its execution page and the pictures of
 * them. No JSX and no imports, so a server module or a skeleton can read it.
 */

/** The statuses a script execution has (the product's `ScriptExecutionStatus`). */
export type ScriptExecutionStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';

/** How an execution was dispatched (the product's `ExecutionSource`). */
export type ScriptExecutionSource = 'MANUAL' | 'SCHEDULED' | 'AI_ASSISTANT';

/** The `Tag` colour a status is drawn in. */
export type ScriptExecutionStatusVariant = 'success' | 'error' | 'warning' | 'grey';

export interface ScriptExecutionStatusPresentation {
  /** Human label (SUCCESS reads as "Completed"). */
  label: string;
  variant: ScriptExecutionStatusVariant;
  /** Not a final state: a page showing it polls until it is. */
  inFlight: boolean;
}

/**
 * Every status, exhaustively. A host whose API grows a status checks its own
 * enum against these keys, so a new status fails to compile there instead of
 * landing in a grey tag with its raw value.
 */
export const SCRIPT_EXECUTION_STATUS_PRESENTATION = {
  QUEUED: { label: 'Queued', variant: 'grey', inFlight: true },
  RUNNING: { label: 'Running', variant: 'warning', inFlight: true },
  SUCCESS: { label: 'Completed', variant: 'success', inFlight: false },
  FAILED: { label: 'Failed', variant: 'error', inFlight: false },
} as const satisfies Record<ScriptExecutionStatus, ScriptExecutionStatusPresentation>;

/** The presentation of a status, or undefined for a value the table does not know. */
export function scriptExecutionStatus(
  status: string | null | undefined,
): ScriptExecutionStatusPresentation | undefined {
  if (!status || !Object.prototype.hasOwnProperty.call(SCRIPT_EXECUTION_STATUS_PRESENTATION, status)) return undefined;
  return SCRIPT_EXECUTION_STATUS_PRESENTATION[status as ScriptExecutionStatus];
}
