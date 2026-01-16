import type { SVGProps } from "react";
export interface BracketRoundXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BracketRoundXmarkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BracketRoundXmarkIconProps) {
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
        d="M14.705 7.705a1.125 1.125 0 0 1 1.59 1.59L13.59 12l2.706 2.706.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076L12 13.59l-2.704 2.706a1.125 1.125 0 0 1-1.59-1.591l2.704-2.706-2.704-2.704-.078-.085A1.125 1.125 0 0 1 9.21 7.627l.085.078L12 10.409z"
      />
    </svg>
  );
}
