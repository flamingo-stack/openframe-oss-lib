import type { SVGProps } from "react";
export interface SignalLevelIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SignalLevelIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SignalLevelIconProps) {
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
        d="M6.875 21v-6a1.125 1.125 0 0 1 2.25 0v6a1.125 1.125 0 0 1-2.25 0m8 0V7a1.125 1.125 0 0 1 2.25 0v14a1.125 1.125 0 0 1-2.25 0m-12 0v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m8 0V11a1.126 1.126 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0m8 0V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
