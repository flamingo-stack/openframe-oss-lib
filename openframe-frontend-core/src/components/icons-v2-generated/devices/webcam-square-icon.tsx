import type { SVGProps } from "react";
export interface WebcamSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WebcamSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WebcamSquareIconProps) {
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
        d="M14.205 16.204a1.124 1.124 0 0 1 1.505-.076l.086.076 2.293 2.294c1.338 1.339.39 3.627-1.503 3.627H7.413c-1.893 0-2.84-2.288-1.503-3.627l2.294-2.294a1.125 1.125 0 0 1 1.591 1.59l-2.08 2.081h8.568l-2.079-2.08-.078-.085a1.126 1.126 0 0 1 .078-1.506ZM13.375 10a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m2.25 0a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0"
      />
      <path
        fill={color}
        d="M17.875 6c0-1.036-.84-1.875-1.876-1.875H8c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h8a1.875 1.875 0 0 0 1.875-1.875zm2.25 8a4.125 4.125 0 0 1-4.126 4.125H8a4.125 4.125 0 0 1-4.125-4.126V6A4.125 4.125 0 0 1 8 1.875h8A4.125 4.125 0 0 1 20.124 6v8Z"
      />
    </svg>
  );
}
