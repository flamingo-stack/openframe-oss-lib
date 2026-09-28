import { cn } from '../../utils/cn';

interface Props {
  rows?: number;
  className?: string;
}

export function UsersGridSkeleton({ rows = 10, className }: Props) {
  const skeletonRows = Array.from({ length: rows });
  return (
    <div className={cn('animate-pulse overflow-x-auto rounded-lg border border-ods-border bg-ods-card', className)}>
      <table className="min-w-full divide-y divide-ods-border">
        <thead className="bg-ods-skeleton">
          <tr>
            {['Name', 'Email', 'Role', 'Created', 'Last Sign-In'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-ods-text-primary text-h6">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ods-border">
          {skeletonRows.map((_, idx) => (
            <tr key={idx}>
              {Array.from({ length: 5 }).map((__, cell) => (
                <td key={cell} className="whitespace-nowrap px-4 py-3">
                  <div className="h-4 w-full rounded bg-ods-border"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
