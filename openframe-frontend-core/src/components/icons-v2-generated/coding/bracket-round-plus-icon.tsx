import type { SVGProps } from "react";
export interface BracketRoundPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BracketRoundPlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BracketRoundPlusIconProps) {
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
        d="M.875 12c0-4.102 2.037-7.728 5.15-9.92l.099-.061a1.126 1.126 0 0 1 1.198 1.9l-.466.35A9.86 9.86 0 0 0 3.125 12c0 3.13 1.456 5.92 3.731 7.731l.466.349.09.072a1.125 1.125 0 0 1-1.288 1.83l-.099-.062-.57-.428A12.1 12.1 0 0 1 .876 12Zm20 0a9.86 9.86 0 0 0-4.197-8.08l.649-.92.647-.92a12.11 12.11 0 0 1 5.15 9.92c0 4.102-2.037 7.727-5.15 9.92a1.125 1.125 0 0 1-1.296-1.84A9.86 9.86 0 0 0 20.875 12m-4.468-9.648a1.125 1.125 0 0 1 1.567-.272l-1.296 1.84a1.125 1.125 0 0 1-.271-1.567Z"
      />
      <path
        fill={color}
        d="M10.876 16v-2.874H8a1.125 1.125 0 0 1 0-2.25h2.876V8a1.125 1.125 0 0 1 2.25 0v2.876h2.873l.116.005a1.125 1.125 0 0 1 0 2.239l-.115.006h-2.874v2.873a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
