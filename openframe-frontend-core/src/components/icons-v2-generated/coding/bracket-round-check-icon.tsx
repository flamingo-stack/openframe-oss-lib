import type { SVGProps } from "react";
export interface BracketRoundCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BracketRoundCheckIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BracketRoundCheckIconProps) {
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
        d="M15.705 8.205a1.125 1.125 0 1 1 1.59 1.59l-6 6c-.439.44-1.151.44-1.59 0l-3-3-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 2.205 2.204z"
      />
    </svg>
  );
}
