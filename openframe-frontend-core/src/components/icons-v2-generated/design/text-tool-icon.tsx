import type { SVGProps } from "react";
export interface TextToolIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TextToolIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TextToolIconProps) {
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
        d="M18.875 8V7c0-1.035-.84-1.875-1.875-1.875h-3.876v13.75H15l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H9a1.126 1.126 0 0 1 0-2.25h1.875V5.125H7c-1.036 0-1.875.84-1.875 1.875v1a1.125 1.125 0 0 1-2.25 0V7A4.125 4.125 0 0 1 7 2.875h10A4.125 4.125 0 0 1 21.125 7v1a1.126 1.126 0 0 1-2.25 0"
      />
    </svg>
  );
}
