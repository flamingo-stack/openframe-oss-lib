import type { SVGProps } from "react";
export interface BeerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BeerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BeerIconProps) {
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
        d="M19.875 11a.874.874 0 0 0-.875-.874h-.875v5.623l1.4-1.049a.88.88 0 0 0 .35-.7zm2.25 3c0 .984-.463 1.91-1.25 2.5l-2.75 2.061V19a4.125 4.125 0 0 1-4.124 4.125H7A4.125 4.125 0 0 1 2.875 19V8a1.125 1.125 0 0 1 2.25 0v11c0 1.035.84 1.875 1.875 1.875h7c1.036 0 1.876-.84 1.876-1.875V8a1.125 1.125 0 0 1 2.242-.125H19A3.124 3.124 0 0 1 22.125 11z"
      />
      <path
        fill={color}
        d="M6.375 18.5v-7a1.125 1.125 0 0 1 2.25 0v7a1.125 1.125 0 0 1-2.25 0m3 0v-7a1.125 1.125 0 0 1 2.25 0v7a1.125 1.125 0 0 1-2.25 0m3 0v-7a1.125 1.125 0 0 1 2.25 0v7a1.125 1.125 0 0 1-2.25 0m4.5-12a.375.375 0 0 0-.375-.375h-.536c-.56 0-1.034-.412-1.113-.965a2.376 2.376 0 0 0-4.294-1.026 1.126 1.126 0 0 1-1.535.293 1.876 1.876 0 0 0-2.79.948c-.16.45-.584.75-1.061.75H4.5a.375.375 0 1 0 0 .75h12a.375.375 0 0 0 .375-.375m2.25 0A2.625 2.625 0 0 1 16.5 9.125h-12a2.625 2.625 0 0 1-.035-5.249 4.12 4.12 0 0 1 4.894-1.77 4.623 4.623 0 0 1 7.477 1.79A2.625 2.625 0 0 1 19.125 6.5"
      />
    </svg>
  );
}
