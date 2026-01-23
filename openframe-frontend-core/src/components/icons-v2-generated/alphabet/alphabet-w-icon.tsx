import type { SVGProps } from "react";
export interface AlphabetWIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetWIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetWIconProps) {
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
        d="M3.829 2.888a1.125 1.125 0 0 1 1.26.828l.023.113 2.245 14.606 3.088-10.183.049-.139c.534-1.352 2.479-1.352 3.013 0l.048.14 3.085 10.182 2.25-14.606a1.124 1.124 0 1 1 2.223.342l-2.33 15.15c-.344 2.235-3.48 2.458-4.136.294L12 10.88l-2.647 8.735c-.657 2.164-3.79 1.942-4.134-.293l-2.33-15.15-.012-.115c-.03-.57.376-1.08.952-1.169"
      />
    </svg>
  );
}
