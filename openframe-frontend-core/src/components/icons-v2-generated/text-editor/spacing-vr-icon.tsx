import type { SVGProps } from "react";
export interface SpacingVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SpacingVrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SpacingVrIconProps) {
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
        d="m21 19.875.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H3a1.125 1.125 0 0 1 0-2.25zm0-18 .114.006a1.125 1.125 0 0 1 0 2.238L21 4.125H3a1.125 1.125 0 0 1 0-2.25zm-9.555 3.646c.4-.227.91-.19 1.276.115l3 2.5.083.078a1.124 1.124 0 0 1-1.433 1.72l-.092-.07-1.154-.962v6.195l1.154-.96a1.126 1.126 0 0 1 1.442 1.728l-3 2.499a1.13 1.13 0 0 1-1.442 0l-3-2.5-.083-.078a1.124 1.124 0 0 1 1.432-1.72l.093.07 1.154.961V8.902l-1.154.963a1.126 1.126 0 0 1-1.442-1.729l3-2.5z"
      />
    </svg>
  );
}
