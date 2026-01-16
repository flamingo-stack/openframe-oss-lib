import type { SVGProps } from "react";
export interface BracketRoundIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BracketRoundIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BracketRoundIconProps) {
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
        d="M19.875 12c0-3.13-1.455-5.92-3.73-7.731l-.466-.35-.091-.07a1.125 1.125 0 0 1 1.289-1.83l.097.061.57.428A12.1 12.1 0 0 1 22.126 12c0 4.102-2.038 7.727-5.151 9.92a1.125 1.125 0 0 1-1.295-1.84A9.86 9.86 0 0 0 19.875 12m-18 0c0-4.102 2.037-7.727 5.15-9.92l.099-.061a1.126 1.126 0 0 1 1.198 1.9l-.466.35A9.86 9.86 0 0 0 4.125 12c0 3.13 1.456 5.92 3.731 7.731l.466.35.09.07a1.125 1.125 0 0 1-1.288 1.83l-.099-.061-.57-.428A12.1 12.1 0 0 1 1.876 12Z"
      />
    </svg>
  );
}
