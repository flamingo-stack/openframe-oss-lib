import type { SVGProps } from "react";
export interface Login02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Login02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Login02IconProps) {
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
        d="M7.875 18v-1a1.125 1.125 0 0 1 2.25 0v1c0 1.035.84 1.875 1.875 1.875h5c1.035 0 1.875-.84 1.875-1.875V6c0-1.036-.84-1.875-1.875-1.875h-5c-1.036 0-1.875.84-1.875 1.875v1a1.125 1.125 0 0 1-2.25 0V6A4.125 4.125 0 0 1 12 1.875h5A4.125 4.125 0 0 1 21.125 6v12A4.125 4.125 0 0 1 17 22.125h-5A4.125 4.125 0 0 1 7.875 18"
      />
      <path
        fill={color}
        d="M12.205 8.205a1.125 1.125 0 0 1 1.505-.078l.085.078 3 3a1.125 1.125 0 0 1 0 1.59l-3 3a1.125 1.125 0 1 1-1.59-1.59l1.08-1.08H4a1.125 1.125 0 0 1 0-2.25h9.284l-1.08-1.08-.077-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
