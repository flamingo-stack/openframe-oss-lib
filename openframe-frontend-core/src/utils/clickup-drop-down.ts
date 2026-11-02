/**
 * Reading a ClickUp drop-down custom field off a task (pure, server-safe).
 *
 * ClickUp sends a task's custom fields with each field's options as they are now: a drop-down's `value` is the chosen
 * option's POSITION (`orderindex`), and newer answers may send the option's id. The option's id is stable; its name
 * changes when the field's owner renames it (the Team field's "Design" became "Product"), so a reader resolves the
 * chosen option's id first and its name from the field's own options.
 */

export interface ClickUpDropDownOption {
  id?: string;
  name?: string;
  orderindex?: number | string;
}

export interface ClickUpCustomFieldValue {
  id?: string;
  value?: unknown;
  type_config?: { options?: ClickUpDropDownOption[] };
}

function optionsOf(field: ClickUpCustomFieldValue | undefined): ClickUpDropDownOption[] {
  return Array.isArray(field?.type_config?.options) ? field.type_config.options : [];
}

function fieldOf(fields: unknown, fieldId: string): ClickUpCustomFieldValue | undefined {
  return Array.isArray(fields) ? (fields as ClickUpCustomFieldValue[]).find(f => f?.id === fieldId) : undefined;
}

/** The chosen option of a drop-down field, or null when the task has no value (or one its options do not hold). */
export function clickUpDropDownOption(fields: unknown, fieldId: string): { id: string; name: string | null } | null {
  const field = fieldOf(fields, fieldId);
  const value = field?.value;
  if (value === null || value === undefined || value === '') return null;
  const options = optionsOf(field);
  const byId = typeof value === 'string' ? options.find(o => o.id === value) : undefined;
  const position = Number(value);
  const option = byId ?? (Number.isFinite(position) ? options.find(o => Number(o.orderindex) === position) : undefined);
  if (!option?.id) return null;
  return { id: option.id, name: option.name?.trim() || null };
}
