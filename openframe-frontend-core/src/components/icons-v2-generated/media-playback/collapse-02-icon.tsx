import type { SVGProps } from "react";
export interface Collapse02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Collapse02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Collapse02IconProps) {
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
        d="M20.205 2.205a1.125 1.125 0 1 1 1.59 1.59l-4.079 4.08h2.785l.114.006a1.126 1.126 0 0 1 0 2.238l-.114.006H15A1.125 1.125 0 0 1 13.874 9V3.5a1.125 1.125 0 0 1 2.25 0v2.784l4.08-4.08ZM10.125 20.5a1.125 1.125 0 0 1-2.25 0v-2.784l-4.08 4.08a1.125 1.125 0 1 1-1.59-1.591l4.08-4.08H3.5a1.125 1.125 0 0 1 0-2.25H9A1.125 1.125 0 0 1 10.125 15z"
      />
    </svg>
  );
}
