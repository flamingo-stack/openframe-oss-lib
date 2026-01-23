import type { SVGProps } from "react";
export interface FolderLockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderLockIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FolderLockIconProps) {
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
        d="M10.125 16.375h3.75v-1.75h-3.75zm2.5-5.124a.626.626 0 0 0-1.25 0v1.125h1.25zm2.25 1.314a2.12 2.12 0 0 1 1.25 1.934V16.5a2.125 2.125 0 0 1-2.126 2.125h-3.998A2.125 2.125 0 0 1 7.875 16.5v-2c0-.862.513-1.602 1.25-1.935V11.25a2.876 2.876 0 0 1 5.75 0z"
      />
    </svg>
  );
}
