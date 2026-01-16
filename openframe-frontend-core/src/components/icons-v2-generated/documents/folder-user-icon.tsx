import type { SVGProps } from "react";
export interface FolderUserIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderUserIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FolderUserIconProps) {
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
        d="M.875 18V6A4.125 4.125 0 0 1 5 1.875h4.586c.493 0 .969.172 1.347.482l.155.14 2.377 2.378H19A4.125 4.125 0 0 1 23.125 9v9A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18m2.25 0c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875V9c0-1.036-.84-1.875-1.875-1.875h-5.586c-.493 0-.968-.172-1.346-.482l-.157-.14-2.377-2.378H5c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="M14.124 18c0-.76-.614-1.375-1.373-1.375h-1.5c-.76 0-1.376.616-1.376 1.375a1.125 1.125 0 0 1-2.25 0 3.626 3.626 0 0 1 3.626-3.626h1.5A3.625 3.625 0 0 1 16.375 18a1.125 1.125 0 0 1-2.25 0Zm-1.373-7.125a.75.75 0 1 0-1.501 0 .75.75 0 0 0 1.5 0Zm2.25 0a3 3 0 1 1-6.001 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}
