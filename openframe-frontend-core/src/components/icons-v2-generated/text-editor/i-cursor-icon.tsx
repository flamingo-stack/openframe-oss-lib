import type { SVGProps } from "react";
export interface ICursorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ICursorIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ICursorIconProps) {
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
        d="M10.875 17V7l-.015-.294A2.876 2.876 0 0 0 8 4.125h-.5a1.125 1.125 0 0 1 0-2.25H8c1.618 0 3.06.75 4 1.922a5.12 5.12 0 0 1 4-1.922h.5a1.125 1.125 0 0 1 0 2.25H16A2.876 2.876 0 0 0 13.125 7v10A2.876 2.876 0 0 0 16 19.875h.5a1.125 1.125 0 0 1 0 2.25H16a5.12 5.12 0 0 1-4-1.923 5.12 5.12 0 0 1-4 1.923h-.5a1.125 1.125 0 0 1 0-2.25H8A2.876 2.876 0 0 0 10.875 17"
      />
      <path
        fill={color}
        d="m14.5 10.875.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H9.5a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
