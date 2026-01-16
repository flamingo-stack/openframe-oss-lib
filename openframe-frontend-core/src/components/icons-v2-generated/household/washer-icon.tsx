import type { SVGProps } from "react";
export interface WasherIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WasherIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: WasherIconProps) {
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
        d="M19.875 5c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 18 23.125H6A4.125 4.125 0 0 1 1.875 19V5A4.125 4.125 0 0 1 6 .875h12A4.125 4.125 0 0 1 22.125 5z"
      />
      <path
        fill={color}
        d="M12 6.375a6.626 6.626 0 1 1-.001 13.252 6.626 6.626 0 0 1 0-13.252Zm3.156 6.763c-.638-.059-1.275.069-1.756.349l-1.669.971c-.942.549-2.06.74-3.095.644a6 6 0 0 1-.511-.076 4.371 4.371 0 0 0 8.218-1.517 2.8 2.8 0 0 0-1.187-.37ZM12 8.625a4.374 4.374 0 0 0-4.343 3.864c.313.192.721.33 1.188.372.638.06 1.274-.068 1.755-.348l1.669-.972c.942-.548 2.06-.74 3.095-.644q.255.026.511.075A4.37 4.37 0 0 0 12 8.625M6.641 4.132a1.375 1.375 0 1 1-1.509 1.51L5.125 5.5l.007-.14A1.375 1.375 0 0 1 6.5 4.125z"
      />
    </svg>
  );
}
