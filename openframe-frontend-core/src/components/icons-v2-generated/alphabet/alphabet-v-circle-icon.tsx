import type { SVGProps } from "react";
export interface AlphabetVCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetVCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetVCircleIconProps) {
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
        d="M13.405 7.74a1.125 1.125 0 0 1 2.189.52l-1.77 7.425c-.444 1.86-3.022 1.918-3.599.174l-.048-.174L8.406 8.26l-.02-.113a1.125 1.125 0 0 1 2.176-.52l.032.111L12 13.632l1.406-5.893Z"
      />
    </svg>
  );
}
