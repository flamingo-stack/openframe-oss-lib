import type { SVGProps } from "react";
export interface KeyOptionIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function KeyOptionIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: KeyOptionIconProps) {
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
        d="m22 2.875.115.006a1.125 1.125 0 0 1 0 2.238L22 5.125h-5a1.125 1.125 0 0 1 0-2.25zm-16.108 0c1.077 0 2.079.556 2.65 1.47l8.824 14.119c.16.256.441.412.743.412h3.89l.116.005a1.125 1.125 0 0 1 0 2.239l-.115.005h-3.891a3.13 3.13 0 0 1-2.65-1.469L6.633 5.536a.88.88 0 0 0-.74-.411H2a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
