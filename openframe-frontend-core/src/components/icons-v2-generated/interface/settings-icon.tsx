import type { SVGProps } from "react";
export interface SettingsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SettingsIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: SettingsIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 22"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M15.509.875c1.469 0 2.827.781 3.565 2.05l3.49 6a4.13 4.13 0 0 1 0 4.15l-3.49 6a4.13 4.13 0 0 1-3.565 2.05H8.49a4.13 4.13 0 0 1-3.567-2.05l-3.49-6a4.13 4.13 0 0 1 0-4.15l3.49-6A4.13 4.13 0 0 1 8.49.876zM8.49 3.125c-.668 0-1.286.355-1.622.932l-3.49 6a1.88 1.88 0 0 0 0 1.886l3.49 6c.336.577.954.932 1.622.932h7.018c.667 0 1.284-.355 1.62-.932l3.49-6a1.88 1.88 0 0 0 0-1.886l-3.49-6a1.88 1.88 0 0 0-1.62-.932z"
      />
      <path
        fill={color}
        d="M13.875 11a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
    </svg>
  );
}
