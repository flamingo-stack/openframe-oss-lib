import type { SVGProps } from "react";
export interface Megaphone02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Megaphone02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Megaphone02IconProps) {
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
        d="M6.442 14.881a1.125 1.125 0 0 1 1.451.403l.058.101 2.642 5.285.059.085a.371.371 0 0 0 .624-.369l-1.344-4.031L11 16l1.067-.355 1.345 4.03a2.622 2.622 0 0 1-4.744 2.164l-.088-.162-2.642-5.285-.046-.106a1.126 1.126 0 0 1 .55-1.405m8.433 1.12V6a1.125 1.125 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0Zm-4.23-1.068a1.125 1.125 0 0 1 1.422.712l-2.135.71a1.125 1.125 0 0 1 .712-1.422Z"
      />
      <path
        fill={color}
        d="M22.125 18.999c0 1.892-2.267 2.813-3.589 1.54l-.124-.13-2.918-3.284H8a6.125 6.125 0 0 1 0-12.25h7.495l2.917-3.282.124-.13c1.322-1.272 3.589-.35 3.589 1.542V19ZM4.125 11A3.875 3.875 0 0 0 8 14.875h8l.12.006c.276.03.534.162.721.372l3.034 3.416V3.334l-3.034 3.414c-.213.24-.52.376-.84.377H8A3.876 3.876 0 0 0 4.125 11"
      />
    </svg>
  );
}
