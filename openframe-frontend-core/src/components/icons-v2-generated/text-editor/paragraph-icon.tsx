import type { SVGProps } from "react";
export interface ParagraphIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ParagraphIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ParagraphIconProps) {
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
        d="M14.874 20V5.125h-1.748V20a1.126 1.126 0 0 1-2.25 0v-6.876H9A5.125 5.125 0 1 1 9 2.875h10l.115.006a1.125 1.125 0 0 1 0 2.238L19 5.125h-1.875V20a1.125 1.125 0 0 1-2.25 0ZM6.125 8A2.875 2.875 0 0 0 9 10.874h1.876V5.125H9A2.876 2.876 0 0 0 6.125 8"
      />
    </svg>
  );
}
