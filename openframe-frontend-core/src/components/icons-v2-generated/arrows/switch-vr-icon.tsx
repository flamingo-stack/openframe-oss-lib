import type { SVGProps } from "react";
export interface SwitchVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SwitchVrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SwitchVrIconProps) {
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
        d="M15.876 4a1.125 1.125 0 0 1 2.25 0v13.283l2.078-2.078a1.125 1.125 0 0 1 1.591 1.59l-4 4c-.438.44-1.15.44-1.59 0l-4-4-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 2.08 2.08zm-10 16V6.716l-2.08 2.08a1.125 1.125 0 0 1-1.591-1.59l4-4.001.085-.078a1.126 1.126 0 0 1 1.506.078l3.999 4 .078.085a1.126 1.126 0 0 1-1.582 1.582l-.087-.076-2.078-2.08V20a1.126 1.126 0 0 1-2.25 0"
      />
    </svg>
  );
}
