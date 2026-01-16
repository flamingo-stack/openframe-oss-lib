import type { SVGProps } from "react";
export interface GraphLineUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GraphLineUpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GraphLineUpIconProps) {
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
        d="M1.875 3a1.125 1.125 0 0 1 2.25 0v16.875H21a1.125 1.125 0 0 1 0 2.25H3A1.125 1.125 0 0 1 1.875 21z"
      />
      <path
        fill={color}
        d="M17.932 4.644a1.126 1.126 0 0 1 2.136.712l-2.063 6.186c-.832 2.499-4.158 2.884-5.566.746l-.13-.216-.585-1.051a.875.875 0 0 0-1.595.147l-2.061 6.188a1.126 1.126 0 0 1-2.136-.712l2.063-6.186.089-.236c.99-2.362 4.328-2.597 5.607-.294l.585 1.051a.875.875 0 0 0 1.595-.147z"
      />
    </svg>
  );
}
