import type { SVGProps } from "react";
export interface FolderEditIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderEditIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FolderEditIconProps) {
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
        d="M.875 18V6A4.125 4.125 0 0 1 5 1.875h4.586c.493 0 .969.172 1.347.482l.155.14 2.377 2.378H19A4.125 4.125 0 0 1 23.125 9v.397a1.125 1.125 0 0 1-2.25 0V9c0-1.036-.84-1.875-1.875-1.875h-5.586c-.493 0-.968-.172-1.346-.482l-.157-.14-2.377-2.378H5c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h4.047l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H5A4.125 4.125 0 0 1 .875 18"
      />
      <path
        fill={color}
        d="M18.089 12.645a2.624 2.624 0 0 1 3.712 0l.554.554.18.2a2.626 2.626 0 0 1 0 3.313l-.18.199-1.336 1.334-.01.014-.014.01-3.39 3.391a4.13 4.13 0 0 1-2.238 1.153l-1.778.296a1.475 1.475 0 0 1-1.698-1.698l.296-1.778a4.13 4.13 0 0 1 1.153-2.239zm-3.158 6.34c-.277.277-.46.633-.525 1.018l-.118.708.709-.117a1.88 1.88 0 0 0 1.018-.525l2.606-2.607-1.084-1.084zm5.279-4.749a.375.375 0 0 0-.53 0l-.551.551 1.084 1.084.55-.55a.376.376 0 0 0 .049-.473l-.048-.058z"
      />
    </svg>
  );
}
