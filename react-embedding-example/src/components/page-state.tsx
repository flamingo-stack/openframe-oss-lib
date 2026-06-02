// Shared error state for the route pages (ODS-token styled, no hardcoded colors).
export function PageError({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="p-10">
      <h2 className="text-lg font-semibold text-ods-text-primary">{title}</h2>
      {detail ? <p className="mt-2 text-sm text-ods-text-secondary">{detail}</p> : null}
    </div>
  )
}
