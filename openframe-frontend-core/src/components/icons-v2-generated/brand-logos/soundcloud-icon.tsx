import type { SVGProps } from "react";
export interface SoundcloudIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SoundcloudIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SoundcloudIconProps) {
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
        d="M20.875 15a2.88 2.88 0 0 0-1.763-2.652 8 8 0 0 1-.324 1.973 1.125 1.125 0 1 1-2.156-.642 5.9 5.9 0 0 0 .183-2.52 5.876 5.876 0 0 0-6.69-4.968v11.684H18A2.875 2.875 0 0 0 20.875 15m2.25 0A5.125 5.125 0 0 1 18 20.126h-8A2.125 2.125 0 0 1 7.876 18V6.036c0-.91.606-1.835 1.646-2.026l.362-.059a8.127 8.127 0 0 1 8.978 5.996A5.13 5.13 0 0 1 23.125 15M.875 19v-7a1.125 1.125 0 0 1 2.25 0v7a1.125 1.125 0 0 1-2.25 0m3.5 0V8a1.125 1.125 0 0 1 2.25 0v11a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
