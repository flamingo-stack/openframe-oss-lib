import type { SVGProps } from "react";
export interface AlphabetQSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetQSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetQSquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M13.125 10.25a1.125 1.125 0 0 0-2.25 0v3.5c0 .44.255.817.624 1.002a1.12 1.12 0 0 1 .205-1.297 1.13 1.13 0 0 1 1.421-.142zm2.25 3.5a3.36 3.36 0 0 1-.332 1.451l.002.003.078.086a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-.003-.003a3.36 3.36 0 0 1-1.452.332 3.375 3.375 0 0 1-3.375-3.374v-3.5a3.375 3.375 0 1 1 6.75 0z"
      />
    </svg>
  );
}
