import type { SVGProps } from "react";
export interface DraggerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DraggerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DraggerIconProps) {
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
        d="M15.125 11a1.125 1.125 0 0 1 0 2.25h-7a1.125 1.125 0 0 1 0-2.25zM15.125 16l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005h-7a1.125 1.125 0 0 1 0-2.25zm0-10a1.125 1.125 0 0 1 0 2.25h-7a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
