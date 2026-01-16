import type { SVGProps } from "react";
export interface PresentationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PresentationIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PresentationIconProps) {
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
        d="M10.875 22v-1.398l-2.751 1.834a1.126 1.126 0 0 1-1.248-1.872l3.999-2.666V16a1.125 1.125 0 0 1 2.25 0v1.898l3.999 2.666.092.07a1.125 1.125 0 0 1-1.24 1.861l-.1-.059-2.751-1.834V22a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.375 3.125H4.625v9.874c0 1.036.84 1.875 1.875 1.875h11a1.875 1.875 0 0 0 1.875-1.875zm2.25 9.874a4.125 4.125 0 0 1-4.125 4.126h-11a4.125 4.125 0 0 1-4.125-4.126V3.125H2a1.125 1.125 0 0 1 0-2.25h20l.115.006a1.125 1.125 0 0 1 0 2.238L22 3.125h-.375z"
      />
    </svg>
  );
}
