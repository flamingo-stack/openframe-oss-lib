import type { SVGProps } from "react";
export interface AlphabetACircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetACircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetACircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M10.225 8.14c.559-1.687 2.99-1.687 3.55 0l.05.175 1.769 7.424.022.113a1.125 1.125 0 0 1-2.178.52l-.033-.112-.39-1.635h-2.031l-.39 1.635a1.125 1.125 0 1 1-2.188-.521l1.77-7.424.05-.174Zm1.296 4.236h.958L12 10.367z"
      />
    </svg>
  );
}
