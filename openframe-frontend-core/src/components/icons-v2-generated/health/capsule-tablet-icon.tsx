import type { SVGProps } from "react";
export interface CapsuleTabletIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CapsuleTabletIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CapsuleTabletIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M17 10.874a6.125 6.125 0 1 1-.002 12.251A6.125 6.125 0 0 1 17 10.875Zm-3.707 7.251a3.875 3.875 0 0 0 7.415 0zm3.707-5a3.88 3.88 0 0 0-3.707 2.75h7.415A3.88 3.88 0 0 0 17 13.125m-9.795-5.92a1.125 1.125 0 0 1 1.506-.078l.085.078 2.654 2.654.078.085a1.126 1.126 0 0 1-1.584 1.584l-.085-.078-2.654-2.654-.078-.085a1.125 1.125 0 0 1 .078-1.506m6.747-2.723a3.25 3.25 0 0 1 4.097 0l.246.222.078.085a1.125 1.125 0 0 1-1.582 1.584l-.087-.078-.155-.127a1 1 0 0 0-1.097 0l-.157.127-.5.501a1.126 1.126 0 0 1-1.59-1.592l.5-.5z"
      />
      <path
        fill={color}
        d="M11.938 2.445a6.102 6.102 0 0 1 9.785 6.712l-2.102-.803a3.852 3.852 0 0 0-6.32-4.101L4.254 13.3a3.851 3.851 0 0 0 4.118 6.314l.11-.037a1.126 1.126 0 0 1 .703 2.134l-.413.144A6.101 6.101 0 0 1 2.663 11.71l9.048-9.049zm9.785 6.712a1.124 1.124 0 0 1-2.102-.803z"
      />
    </svg>
  );
}
