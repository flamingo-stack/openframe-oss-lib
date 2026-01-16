import type { SVGProps } from "react";
export interface MoveIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MoveIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MoveIconProps) {
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
        d="M18.204 8.205a1.126 1.126 0 0 1 1.506-.078l.085.078 3 3c.44.439.44 1.151 0 1.59l-3 3a1.125 1.125 0 0 1-1.591-1.59l1.08-1.08H4.716l1.08 1.08.077.085a1.126 1.126 0 0 1-1.584 1.583l-.084-.078-3-3a1.125 1.125 0 0 1 0-1.59l3-3a1.125 1.125 0 1 1 1.59 1.59l-1.08 1.08h14.569l-1.08-1.08-.076-.085a1.125 1.125 0 0 1 .076-1.505"
      />
      <path
        fill={color}
        d="M11.29 1.127a1.125 1.125 0 0 1 1.505.078l3 3 .078.085a1.126 1.126 0 0 1-1.583 1.583l-.085-.078-1.08-1.08v14.569l1.08-1.08a1.125 1.125 0 0 1 1.59 1.59l-3 3c-.439.44-1.151.44-1.59 0l-3-3-.078-.084a1.126 1.126 0 0 1 1.583-1.582l.085.076 1.08 1.08V4.716l-1.08 1.08a1.125 1.125 0 1 1-1.59-1.591l3-3z"
      />
    </svg>
  );
}
