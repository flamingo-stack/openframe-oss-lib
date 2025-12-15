import { cn } from "../../utils/cn"

interface Props {
  rows?: number
  className?: string
}

export function UsersGridSkeleton({ rows = 10, className }: Props) {
  const skeletonRows = Array.from({ length: rows })
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-ods-border bg-ods-card animate-pulse', className)}>
      <table className="min-w-full divide-y divide-[#3A3A3A]">
        <thead className="bg-[#2A2A2A]">
          <tr>
            {['Name', 'Email', 'Role', 'Created', 'Last Sign-In'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[12px] font-medium text-ods-text-primary font-['DM_Sans']">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3A3A3A]">
          {skeletonRows.map((_, idx) => (
            <tr key={idx}>
              {Array.from({ length: 5 }).map((__, cell) => (
                <td key={cell} className="px-4 py-3 whitespace-nowrap">
                  <div className="h-4 bg-ods-border rounded w-full"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
} 