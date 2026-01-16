import type { SVGProps } from "react";
export interface AlphabetYIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetYIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetYIconProps) {
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
        d="M10.874 20v-6.818L6.02 4.552l-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.06.097L12 10.593l4.02-7.145.062-.097a1.125 1.125 0 0 1 1.9 1.201l-4.857 8.633V20a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
