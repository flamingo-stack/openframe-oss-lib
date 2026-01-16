import type { SVGProps } from "react";
export interface CodingCommitIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodingCommitIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CodingCommitIconProps) {
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
        d="m8 10.875.115.006a1.125 1.125 0 0 1 0 2.238L8 13.125H3a1.125 1.125 0 0 1 0-2.25zm13 0a1.125 1.125 0 0 1 0 2.25h-5a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M14.874 12a2.875 2.875 0 1 0-5.75 0 2.875 2.875 0 0 0 5.75 0m2.25 0a5.124 5.124 0 1 1-10.248 0 5.124 5.124 0 0 1 10.248 0"
      />
    </svg>
  );
}
