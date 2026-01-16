import type { SVGProps } from "react";
export interface FolderBookmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderBookmarkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FolderBookmarkIconProps) {
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
        d="M.875 18V6A4.125 4.125 0 0 1 5 1.875h4.586c.493 0 .969.172 1.347.482l.155.14 2.377 2.378H19A4.125 4.125 0 0 1 23.125 9v.215a1.125 1.125 0 0 1-2.25 0V9c0-1.036-.84-1.875-1.875-1.875h-5.586c-.493 0-.968-.172-1.346-.482l-.157-.14-2.377-2.378H5c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h6.003l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H5A4.125 4.125 0 0 1 .875 18"
      />
      <path
        fill={color}
        d="M20.875 14.5a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.375.375v5.605l1.627-1.446.17-.125a1.125 1.125 0 0 1 1.325.125l1.628 1.447zm2.25 6.998c0 1.313-1.456 2.05-2.502 1.37l-.203-.156-1.92-1.708-1.92 1.708c-1.049.93-2.704.187-2.705-1.214V14.5a2.625 2.625 0 0 1 2.625-2.625h4a2.625 2.625 0 0 1 2.625 2.625z"
      />
    </svg>
  );
}
