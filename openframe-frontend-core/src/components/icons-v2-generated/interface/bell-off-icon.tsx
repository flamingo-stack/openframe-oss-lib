import type { SVGProps } from "react";
export interface BellOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BellOffIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BellOffIconProps) {
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
        d="M18.377 11.347V9.5a6.375 6.375 0 0 0-7.79-6.218 1.125 1.125 0 1 1-.495-2.195A8.625 8.625 0 0 1 20.627 9.5v1.847a1.125 1.125 0 0 1-2.25 0M14 20.875l.115.005a1.125 1.125 0 0 1 0 2.239l-.116.006h-3.998a1.125 1.125 0 0 1 0-2.25zM3.704 1.204a1.125 1.125 0 0 1 1.505-.078l.085.078 17.5 17.5.077.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-1.217-1.217q-.236.045-.488.046H4.503c-2.321 0-3.5-2.792-1.882-4.456l.225-.23.12-.137c.265-.331.41-.744.41-1.17V9.5A8.6 8.6 0 0 1 5.16 4.25L3.705 2.795l-.078-.085a1.125 1.125 0 0 1 .078-1.505ZM5.626 13.13c0 .94-.32 1.848-.902 2.575l-.265.302-.224.23a.375.375 0 0 0 .268.637h13.282L6.769 5.86A6.34 6.34 0 0 0 5.626 9.5z"
      />
    </svg>
  );
}
