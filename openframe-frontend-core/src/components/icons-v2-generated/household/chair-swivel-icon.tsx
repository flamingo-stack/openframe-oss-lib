import type { SVGProps } from "react";
export interface ChairSwivelIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChairSwivelIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChairSwivelIconProps) {
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
        d="M2.875 14v-2.382A1.125 1.125 0 0 1 3 9.375h1c.622 0 1.125.504 1.125 1.126V14a1.125 1.125 0 0 1-2.25 0m16 0v-3.5c0-.62.503-1.124 1.125-1.125h1l.116.006a1.125 1.125 0 0 1 .009 2.237V14a1.125 1.125 0 0 1-2.25 0M13.785.875A4.126 4.126 0 0 1 17.89 4.59l.73 7.298.005.115a1.126 1.126 0 0 1-2.227.223l-.018-.114-.73-7.298a1.875 1.875 0 0 0-1.864-1.689h-3.572c-.963 0-1.769.73-1.864 1.689l-.73 7.298-.017.114a1.126 1.126 0 0 1-2.223-.338l.73-7.298.058-.39A4.125 4.125 0 0 1 10.214.875h3.572Z"
      />
      <path
        fill={color}
        d="M18.875 14a.876.876 0 0 0-.875-.875H6a.875.875 0 0 0 0 1.75h12a.877.877 0 0 0 .875-.876Zm2.25 0c0 1.725-1.4 3.125-3.125 3.125h-4.876v1.75h2.377c1.725 0 3.124 1.4 3.124 3.125a1.125 1.125 0 0 1-2.25 0 .876.876 0 0 0-.874-.875h-2.377V22a1.125 1.125 0 0 1-2.25 0v-.875H8.5a.875.875 0 0 0-.875.875 1.126 1.126 0 0 1-2.25 0A3.125 3.125 0 0 1 8.5 18.875h2.374v-1.75H6a3.125 3.125 0 0 1 0-6.25h12a3.126 3.126 0 0 1 3.125 3.124Z"
      />
    </svg>
  );
}
