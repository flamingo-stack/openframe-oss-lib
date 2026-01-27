import type { SVGProps } from "react";
export interface CollectionAlbumIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CollectionAlbumIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CollectionAlbumIconProps) {
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
        d="M17.375 14a3.375 3.375 0 1 0-6.75 0 3.375 3.375 0 0 0 6.75 0m-16.5 4V9A8.126 8.126 0 0 1 9 .875h9l.115.006a1.125 1.125 0 0 1 0 2.238L18 3.125H9A5.876 5.876 0 0 0 3.124 9v9a1.125 1.125 0 0 1-2.25 0Zm12.626-4.373a.62.62 0 0 0-.127.373l.014.126a.6.6 0 0 0 .113.246zm.998.745a.6.6 0 0 0 .113-.246l.014-.126-.014-.126a.6.6 0 0 0-.113-.248zM15.624 14a1.624 1.624 0 0 1-3.241.165L12.376 14l.007-.165A1.625 1.625 0 0 1 14 12.375l.165.008c.82.083 1.46.775 1.46 1.617Zm4.001 0a5.625 5.625 0 1 1-11.25 0 5.625 5.625 0 0 1 11.25 0"
      />
      <path
        fill={color}
        d="M20.875 9c0-1.035-.84-1.875-1.875-1.875H9c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 10A4.126 4.126 0 0 1 19 23.125H9A4.125 4.125 0 0 1 4.875 19V9A4.125 4.125 0 0 1 9 4.875h10A4.125 4.125 0 0 1 23.125 9z"
      />
    </svg>
  );
}
