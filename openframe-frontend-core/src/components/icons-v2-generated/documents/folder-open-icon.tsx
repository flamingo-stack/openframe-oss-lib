import type { SVGProps } from "react";
export interface FolderOpenIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FolderOpenIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FolderOpenIconProps) {
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
        d="M2.375 11.063V6A4.125 4.125 0 0 1 6.5 1.875h3.087c.493 0 .968.172 1.346.482l.155.14 2.378 2.378H17.5A4.125 4.125 0 0 1 21.625 9v2.063a1.125 1.125 0 0 1-2.25 0V9c0-1.036-.84-1.875-1.875-1.875h-4.086c-.493 0-.968-.172-1.346-.482l-.157-.14-2.377-2.378H6.5c-1.035 0-1.875.84-1.875 1.875v5.063a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20 9.875a3.125 3.125 0 0 1 3.1 3.519l-.651 5.125a4.13 4.13 0 0 1-4.093 3.607H5.643a4.125 4.125 0 0 1-4.091-3.607L.9 13.394A3.126 3.126 0 0 1 4 9.875zm-16 2.25a.876.876 0 0 0-.868.986l.65 5.125c.12.937.917 1.64 1.86 1.64h12.714c.944 0 1.742-.703 1.86-1.64l.652-5.125a.876.876 0 0 0-.868-.986z"
      />
    </svg>
  );
}
