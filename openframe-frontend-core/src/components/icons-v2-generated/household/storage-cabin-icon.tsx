import type { SVGProps } from "react";
export interface StorageCabinIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StorageCabinIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StorageCabinIconProps) {
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
        d="m20 10.125.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H4a1.125 1.125 0 0 1 0-2.25zm-3.875 5.374a2.125 2.125 0 0 1-2.124 2.126H10a2.126 2.126 0 0 1-2.125-2.126V15a1.125 1.125 0 0 1 2.25 0v.375h3.75V15a1.125 1.125 0 0 1 2.25 0zm0-9a2.125 2.125 0 0 1-2.124 2.126H10A2.126 2.126 0 0 1 7.875 6.5V6a1.125 1.125 0 0 1 2.25 0v.375h3.75V6a1.125 1.125 0 0 1 2.25 0v.5Z"
      />
      <path
        fill={color}
        d="M18.875 5c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v12.5c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 12.5a4.12 4.12 0 0 1-4 4.117V22a1.125 1.125 0 0 1-2.25 0v-.375h-5.75V22a1.125 1.125 0 0 1-2.25 0v-.383a4.12 4.12 0 0 1-4-4.117V5A4.125 4.125 0 0 1 7 .875h10A4.125 4.125 0 0 1 21.125 5z"
      />
    </svg>
  );
}
