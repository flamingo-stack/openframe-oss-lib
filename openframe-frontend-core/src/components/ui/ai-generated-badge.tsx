import { Badge } from './badge';
import { Sparkles } from 'lucide-react';

/**
 * Canonical "AI Generated" chip (Sparkles + label). Single source of truth for
 * every AI-generated indicator across the app — replaces the byte-identical
 * inline `<Badge variant="secondary"><Sparkles/> AI Generated</Badge>` that was
 * copy-pasted across the summary / video / SEO editors.
 */
export function AIGeneratedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" className={`flex items-center gap-1${className ? ` ${className}` : ''}`}>
      <Sparkles className="h-3 w-3" />
      AI Generated
    </Badge>
  );
}
