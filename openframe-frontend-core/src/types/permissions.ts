import { ToolType } from "./tool.types";

export type ApprovalLevel = 'ALLOW' | 'ASK_USER' | 'ASK_TECHNICIAN' | 'DENY';

export interface PermissionPolicy {
  id: string;
  name: string;
  naturalKey: string;
  commandPattern: string;
  toolName: ToolType;
  approvalLevel: ApprovalLevel;
}

/**
 * Pure data describing one permission category. Presentation state (expansion,
 * bulk-selection display) is owned by PolicyConfigurationPanel itself.
 */
export interface PermissionCategory {
  id: string;
  name: string;
  /** Optional leading icon; the panel falls back to a shield. */
  icon?: React.ReactNode;
  policies: PermissionPolicy[];
}

export interface PolicyConfigurationPanelProps {
  categories: PermissionCategory[];
  editMode: boolean;
  /** Change a single policy's approval level. `policyId` is the policy's `id`. */
  onPolicyPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
  /** Bulk-apply an approval level to every policy in a category. */
  onCategoryPermissionChange: (categoryId: string, level: ApprovalLevel) => void;
  className?: string;
}
