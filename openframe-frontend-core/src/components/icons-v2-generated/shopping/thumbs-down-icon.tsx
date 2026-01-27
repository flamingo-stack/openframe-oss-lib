import type { SVGProps } from "react";
export interface ThumbsDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ThumbsDownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ThumbsDownIconProps) {
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
        d="M15.875 13.5V2a1.125 1.125 0 0 1 2.25 0v11.5a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 10.5V5c0-1.035-.84-1.875-1.875-1.875H6.074c-.925 0-1.712.675-1.853 1.59l-1.078 7a1.876 1.876 0 0 0 1.853 2.16H10c.621 0 1.125.504 1.125 1.126v4.5c0 .759.616 1.373 1.376 1.373h.246l3.212-7.803.076-.15c.201-.336.567-.545.965-.545h2c.97 0 1.768-.739 1.865-1.684zm2.25 0-.022.422A4.125 4.125 0 0 1 19 14.626h-1.247l-2.959 7.183a2.12 2.12 0 0 1-1.964 1.316h-.33A3.625 3.625 0 0 1 8.876 19.5v-3.375h-3.88A4.126 4.126 0 0 1 .92 11.372l1.077-6.999.075-.37A4.126 4.126 0 0 1 6.074.874H19A4.125 4.125 0 0 1 23.125 5z"
      />
    </svg>
  );
}
