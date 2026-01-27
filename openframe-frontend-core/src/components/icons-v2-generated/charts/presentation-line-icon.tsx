import type { SVGProps } from "react";
export interface PresentationLineIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PresentationLineIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PresentationLineIconProps) {
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
        d="M19.375 3.125H4.625v9.874c0 1.036.84 1.875 1.875 1.875h11a1.875 1.875 0 0 0 1.875-1.875zm-3.67 2.58a1.125 1.125 0 0 1 1.59 1.59l-2.697 2.699c-.69.69-1.76.82-2.596.319l-1.078-.646-2.628 2.628a1.125 1.125 0 1 1-1.59-1.59l2.696-2.698.135-.123a2.13 2.13 0 0 1 2.302-.284l.159.088 1.078.645 2.63-2.628Zm5.92 7.294a4.125 4.125 0 0 1-4.125 4.126h-11a4.125 4.125 0 0 1-4.125-4.126V3.125H2a1.125 1.125 0 0 1 0-2.25h20l.115.006a1.125 1.125 0 0 1 0 2.238L22 3.125h-.375z"
      />
    </svg>
  );
}
