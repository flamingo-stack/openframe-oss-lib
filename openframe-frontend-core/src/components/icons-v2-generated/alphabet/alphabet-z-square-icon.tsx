import type { SVGProps } from "react";
export interface AlphabetZSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetZSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetZSquareIconProps) {
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
        d="M14.248 6.875c1.034 0 1.674 1.085 1.239 1.973l-.103.174-3.978 5.852h3.093l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.006H9.752a1.375 1.375 0 0 1-1.137-2.148l3.98-5.852H9.5a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
