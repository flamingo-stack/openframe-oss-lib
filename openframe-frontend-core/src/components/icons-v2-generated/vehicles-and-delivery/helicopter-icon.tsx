import type { SVGProps } from "react";
export interface HelicopterIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HelicopterIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HelicopterIconProps) {
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
        d="M11.875 17a1.125 1.125 0 0 1 2.25 0v2.875h3.75V17a1.125 1.125 0 0 1 2.25 0v2.875h.047a.88.88 0 0 0 .618-.256l.415-.415a1.125 1.125 0 0 1 1.59 1.59l-.414.415a3.13 3.13 0 0 1-2.21.916H10a1.125 1.125 0 0 1 0-2.25h1.875zm2-6V4.124H10a1.125 1.125 0 0 1 0-2.25h10l.115.006a1.125 1.125 0 0 1 0 2.238L20 4.125h-3.877v6.874c0 .484.393.877.877.877h5l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006h-5a3.127 3.127 0 0 1-3.126-3.127Z"
      />
      <path
        fill={color}
        d="M20.875 13a4.875 4.875 0 0 0-4.876-4.875H3.14l5.226 1.307a4.13 4.13 0 0 1 3.069 3.323l.118.718a2.876 2.876 0 0 0 2.836 2.402H19c1.035 0 1.874-.84 1.875-1.874zm-20-2.5v-5a1.125 1.125 0 0 1 2.25 0v.375h12.874a7.126 7.126 0 0 1 7.126 7.126v1A4.125 4.125 0 0 1 19 18.125h-4.612a5.126 5.126 0 0 1-5.055-4.283l-.119-.718a1.88 1.88 0 0 0-1.132-1.423l-.264-.087-4.693-1.175v.06a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
