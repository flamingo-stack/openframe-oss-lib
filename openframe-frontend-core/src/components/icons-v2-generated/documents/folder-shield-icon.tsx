import type { SVGProps } from "react";
export interface FolderShieldIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderShieldIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FolderShieldIconProps) {
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
        d="m14.376 11.885-2.377-1.188-2.374 1.188v1.738l.015.168c.07.407.389.906.977 1.45.47.436 1 .792 1.382 1.026.383-.234.913-.59 1.385-1.026.671-.621.992-1.185.992-1.618zm2.25 1.738-.012.262c-.106 1.297-.974 2.335-1.702 3.008a11 11 0 0 1-1.75 1.301l-.395.232a1.58 1.58 0 0 1-1.35.086l-.184-.086c-.416-.232-1.325-.774-2.144-1.532-.728-.674-1.598-1.712-1.704-3.01l-.01-.261v-2.124c0-.616.348-1.178.898-1.454l3-1.5.176-.074a1.63 1.63 0 0 1 1.103 0l.174.074 3 1.5.198.116c.435.3.701.8.701 1.338v2.124Z"
      />
    </svg>
  );
}
