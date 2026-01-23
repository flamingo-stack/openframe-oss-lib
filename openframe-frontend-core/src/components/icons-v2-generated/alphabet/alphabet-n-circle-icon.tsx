import type { SVGProps } from "react";
export interface AlphabetNCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetNCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetNCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M15.624 15.739c0 1.345-1.69 1.847-2.452.858l-.139-.218-2.408-4.576v4.196a1.125 1.125 0 1 1-2.25 0V8.262c0-1.346 1.69-1.847 2.452-.858l.14.218 2.407 4.575V8a1.125 1.125 0 0 1 2.25 0z"
      />
    </svg>
  );
}
