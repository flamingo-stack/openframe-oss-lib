import type { SVGProps } from "react";
export interface CmdIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CmdIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: CmdIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke={color}
        d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"
      />
      <text
        x={12}
        y={16}
        fill={color}
        fontFamily="monospace"
        fontSize={10}
        fontWeight="bold"
        textAnchor="middle"
      >
        {">"}
      </text>
    </svg>
  );
}
