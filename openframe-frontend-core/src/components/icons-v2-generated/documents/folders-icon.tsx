import type { SVGProps } from "react";
export interface FoldersIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FoldersIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FoldersIconProps) {
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
        d="M.875 14V5a1.125 1.125 0 0 1 2.25 0v9A5.876 5.876 0 0 0 9 19.875h9l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H9A8.126 8.126 0 0 1 .874 14Z"
      />
      <path
        fill={color}
        d="M4.875 14V6A4.125 4.125 0 0 1 9 1.875h3.086c.493 0 .969.172 1.347.482l.155.14 1.878 1.878H19A4.125 4.125 0 0 1 23.125 8.5V14A4.125 4.125 0 0 1 19 18.124H9a4.125 4.125 0 0 1-4.125-4.126Zm2.25 0c0 1.035.84 1.874 1.875 1.874h10c1.036 0 1.875-.84 1.875-1.875V8.5c0-1.035-.84-1.874-1.875-1.875h-3.585c-.494 0-.97-.171-1.348-.481l-.155-.141-1.878-1.878H9c-1.036 0-1.875.84-1.875 1.875z"
      />
    </svg>
  );
}
