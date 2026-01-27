import type { SVGProps } from "react";
export interface GameIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GameIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GameIconProps) {
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
        d="M8.375 18.5v-.875H7.5a1.126 1.126 0 0 1 0-2.25h.875V14.5a1.125 1.125 0 0 1 2.25 0v.877h.875l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005h-.874v.875a1.125 1.125 0 0 1-2.25 0Zm-.25-8.625h7.75v-3.75h-7.75zM17.875 18a1.375 1.375 0 0 1-2.742.141l-.007-.14.007-.141a1.374 1.374 0 0 1 1.367-1.235l.14.007c.694.07 1.235.656 1.235 1.368m-2-3a1.375 1.375 0 0 1-2.743.141l-.008-.14.008-.141a1.375 1.375 0 0 1 1.368-1.235l.14.007c.694.07 1.236.657 1.236 1.369Zm2.25-4.5c0 .898-.728 1.625-1.625 1.625h-9a1.625 1.625 0 0 1-1.625-1.624V5.5c0-.898.727-1.625 1.625-1.625h9c.897 0 1.625.727 1.625 1.625z"
      />
      <path
        fill={color}
        d="M18.875 5c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V5A4.125 4.125 0 0 1 7 .875h10A4.125 4.125 0 0 1 21.125 5z"
      />
    </svg>
  );
}
