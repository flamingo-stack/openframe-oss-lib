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

export interface PermissionCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  configurationsCount: number;
  globalPermission?: ApprovalLevel;
  isExpanded: boolean;
  policies: PermissionPolicy[];
}

export interface PolicyConfigurationPanelProps {
  categories: PermissionCategory[];
  editMode: boolean;
  onCategoryToggle: (categoryId: string) => void;
  onGlobalPermissionChange: (categoryId: string, level: ApprovalLevel | undefined) => void;
  onPolicyPermissionChange: (categoryId: string, policyId: string, level: ApprovalLevel) => void;
  className?: string;
}