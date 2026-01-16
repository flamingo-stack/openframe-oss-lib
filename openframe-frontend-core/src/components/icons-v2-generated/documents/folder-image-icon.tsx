import type { SVGProps } from "react";
export interface FolderImageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderImageIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FolderImageIconProps) {
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
        d="M.875 6A4.125 4.125 0 0 1 5 1.875h4.586c.493 0 .969.172 1.347.482l.155.14 2.377 2.378H19A4.125 4.125 0 0 1 23.125 9v9a4.1 4.1 0 0 1-.82 2.458q-.045.072-.102.136A4.12 4.12 0 0 1 19 22.125H5a4.11 4.11 0 0 1-3.302-1.661A4.1 4.1 0 0 1 .875 18zm10.128 11.089c-.83.83-2.176.83-3.006 0L7.5 16.59l-3.161 3.161c.206.078.429.123.662.123h14c.232 0 .454-.046.66-.123L14 14.09zm-7.878.694 2.873-2.87.16-.147a2.126 2.126 0 0 1 2.683 0l.161.146.497.497 2.998-2.997.161-.147a2.13 2.13 0 0 1 2.684 0l.16.147 5.373 5.371V9c0-1.036-.84-1.875-1.875-1.875h-5.586c-.493 0-.968-.172-1.346-.482l-.157-.14-2.377-2.378H5c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="M9.217 7.885a2.126 2.126 0 1 1-2.332 2.332l-.01-.216.01-.219A2.126 2.126 0 0 1 9 7.875z"
      />
    </svg>
  );
}
