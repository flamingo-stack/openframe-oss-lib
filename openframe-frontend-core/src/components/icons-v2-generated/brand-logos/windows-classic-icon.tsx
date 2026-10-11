import type { SVGProps } from "react";
export interface WindowsClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WindowsClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: WindowsClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="m.833 2.226 5.45-.74.002 5.235-5.447.031zM6.28 7.325l.004 5.239-5.446-.746V7.29zm.66-5.935L14.165.34v6.315l-7.225.057zm7.227 5.984-.002 6.287-7.225-1.016-.01-5.283z" />
    </svg>
  );
}
