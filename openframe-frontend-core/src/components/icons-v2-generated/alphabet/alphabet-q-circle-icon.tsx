import type { SVGProps } from "react";
export interface AlphabetQCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetQCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetQCircleIconProps) {
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
        d="M13.125 10.25a1.125 1.125 0 0 0-2.25 0v3.5c0 .44.255.817.624 1.002a1.12 1.12 0 0 1 .205-1.297 1.13 1.13 0 0 1 1.421-.142zm2.25 3.5a3.36 3.36 0 0 1-.332 1.451l.002.003.078.086a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-.003-.003a3.36 3.36 0 0 1-1.452.332 3.375 3.375 0 0 1-3.375-3.374v-3.5a3.375 3.375 0 1 1 6.75 0z"
      />
    </svg>
  );
}
