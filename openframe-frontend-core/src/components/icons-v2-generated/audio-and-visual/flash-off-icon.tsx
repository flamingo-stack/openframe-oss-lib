import type { SVGProps } from "react";
export interface FlashOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FlashOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FlashOffIconProps) {
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
        d="M18.573 12.853a1.126 1.126 0 0 1-1.653-1.528zM15.3.875c1.04 0 1.793.955 1.594 1.94l-.053.199-1.788 5.364a1 1 0 0 1 .104-.004h3.842c1.329 0 2.06 1.484 1.354 2.526l-.162.202-1.618 1.751-1.653-1.528.65-.701h-2.413a1.125 1.125 0 0 1-1.118-1.259 1.1 1.1 0 0 1-.485-.045 1.126 1.126 0 0 1-.712-1.424l1.591-4.771h-5.74a1.122 1.122 0 0 1-1.88-1.12l.051-.141q.03-.069.066-.135l.117-.186c.3-.411.783-.668 1.313-.668zm-14.095.33a1.125 1.125 0 0 1 1.505-.078l.085.078 20 20 .077.086a1.124 1.124 0 0 1-1.581 1.582l-.087-.078-6.147-6.147-5.504 5.954c-1.153 1.245-3.204.112-2.763-1.527l1.736-6.452H5a1.624 1.624 0 0 1-1.547-2.12l1.808-5.651-4.056-4.057-.078-.085a1.125 1.125 0 0 1 .078-1.505m4.652 11.168h3.485c1.002 0 1.75.892 1.61 1.854l-.04.193-1.29 4.792 3.845-4.154L7.05 8.642l-1.194 3.73Z"
      />
    </svg>
  );
}
