interface InfoRowProps {
  label: string
  value: string
  icon?: React.ReactNode
}

export function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex gap-2 items-center w-full">
      <div className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#fafafa] overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </div>
      <div className="flex-1 bg-[#3a3a3a] h-px min-h-px min-w-px" />
      <div className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#fafafa] overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
        {value}
        {icon}
      </div>
    </div>
  )
}