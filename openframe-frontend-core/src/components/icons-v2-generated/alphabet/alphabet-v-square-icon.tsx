import type { SVGProps } from "react";
export interface AlphabetVSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetVSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetVSquareIconProps) {
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
        d="M13.405 7.74a1.125 1.125 0 0 1 2.189.52l-1.77 7.425c-.444 1.86-3.022 1.918-3.599.174l-.048-.174L8.406 8.26l-.02-.113a1.125 1.125 0 0 1 2.176-.52l.032.111L12 13.632l1.406-5.893Z"
      />
    </svg>
  );
}
