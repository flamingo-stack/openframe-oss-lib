import type { SVGProps } from "react";
export interface Parcel03IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Parcel03Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Parcel03IconProps) {
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
        d="M16.125 8.572c0 1.328-1.553 2.037-2.556 1.184v.003L12 8.459l-1.569 1.3-.001-.003c-1.003.852-2.555.144-2.555-1.184V3a1.125 1.125 0 0 1 2.25 0v4.09l1.157-.957.164-.112c.4-.227.908-.19 1.272.112l1.157.957V3a1.125 1.125 0 0 1 2.25 0z"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
