import type { SVGProps } from "react";
export interface StorageClothingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StorageClothingIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StorageClothingIconProps) {
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
        d="M12.14 16.133a1.374 1.374 0 1 1-1.507 1.507l-.007-.14.007-.141A1.374 1.374 0 0 1 12 16.125zM10.874 2a1.125 1.125 0 0 1 2.25 0v11.374H20a1.126 1.126 0 0 1 0 2.25H4a1.125 1.125 0 0 1 0-2.25h6.874zM9.14 6.882a1.375 1.375 0 1 1-1.507 1.51l-.008-.142.008-.14A1.375 1.375 0 0 1 9 6.875zm6 0a1.375 1.375 0 1 1-1.507 1.51l-.007-.142.007-.14A1.375 1.375 0 0 1 15 6.875z"
      />
      <path
        fill={color}
        d="M18.875 5c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v12.5c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 12.5c0 1.7-1.03 3.16-2.5 3.79V22a1.125 1.125 0 0 1-2.25 0v-.375h-8.75V22a1.125 1.125 0 0 1-2.25 0v-.71a4.13 4.13 0 0 1-2.5-3.79V5A4.125 4.125 0 0 1 7 .875h10A4.125 4.125 0 0 1 21.125 5z"
      />
    </svg>
  );
}
