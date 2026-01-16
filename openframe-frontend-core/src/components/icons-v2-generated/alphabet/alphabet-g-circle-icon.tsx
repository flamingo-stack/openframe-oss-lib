import type { SVGProps } from "react";
export interface AlphabetGCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetGCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetGCircleIconProps) {
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
        d="M15.375 13.75A3.366 3.366 0 0 1 12 17.124a3.366 3.366 0 0 1-3.375-3.376V10.25A3.366 3.366 0 0 1 12 6.875c1.35 0 2.684.813 3.223 2.074l.096.258.031.111a1.125 1.125 0 0 1-2.128.693l-.041-.107-.065-.148c-.188-.338-.627-.631-1.116-.631-.629 0-1.125.496-1.125 1.125v3.5c0 .628.496 1.124 1.125 1.124s1.125-.496 1.125-1.125v-.124h-.375a1.125 1.125 0 0 1 0-2.25H14c.759 0 1.375.616 1.375 1.376z"
      />
    </svg>
  );
}
