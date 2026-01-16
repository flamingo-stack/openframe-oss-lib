import type { SVGProps } from "react";
export interface MusicNote01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MusicNote01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MusicNote01IconProps) {
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
        d="M10.875 17.5V5a3.125 3.125 0 0 1 3.983-3.004l3 .857.247.082a3.125 3.125 0 0 1 2.02 2.922V6.7a3.126 3.126 0 0 1-3.984 3.004l-3.016-.862V17.5a1.125 1.125 0 0 1-2.25 0m2.25-11 3.634 1.039a.876.876 0 0 0 1.116-.841v-.84a.88.88 0 0 0-.635-.842l-3-.857A.875.875 0 0 0 13.125 5z"
      />
      <path
        fill={color}
        d="M10.875 17.5a2.375 2.375 0 1 0-4.75.001 2.375 2.375 0 0 0 4.75-.002Zm2.25 0a4.626 4.626 0 1 1-9.248 0 4.626 4.626 0 0 1 9.248 0"
      />
    </svg>
  );
}
