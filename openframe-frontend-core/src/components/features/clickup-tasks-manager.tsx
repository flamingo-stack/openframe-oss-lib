"use client";

import { ArrayEntryManager } from './array-entry-manager';
import { Lightbulb } from 'lucide-react';
import { ReactNode } from 'react';

export interface ClickUpTaskLink {
  clickup_task_id: string; // Just the task ID
  display_order?: number;
}

interface ClickUpTasksManagerProps {
  tasks: ClickUpTaskLink[];
  onChange: (tasks: ClickUpTaskLink[]) => void;
  title?: ReactNode; // Support string or ReactNode for badge integration
  className?: string;
}

export function ClickUpTasksManager({
  tasks,
  onChange,
  title = 'ClickUp Roadmap Tasks', // Default title
  className = ''
}: ClickUpTasksManagerProps) {
  return (
    <ArrayEntryManager
      title={title}
      items={tasks}
      onChange={onChange}
      fieldKey="clickup_task_id"
      placeholder="Task ID (e.g., 86cq2uabk)"
      emptyMessage='No ClickUp tasks linked. Click "Add Task" to link roadmap items.'
      addButtonText="Add Task"
      icon={<Lightbulb className="w-5 h-5 text-ods-text-secondary" />}
      className={className}
    />
  );
}
