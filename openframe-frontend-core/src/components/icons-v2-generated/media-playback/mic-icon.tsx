import type { SVGProps } from "react";
export interface MicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MicIconProps) {
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
        d="M2.875 10.5a1.125 1.125 0 0 1 2.25 0 6.875 6.875 0 0 0 6.874 6.875l.355-.01a6.875 6.875 0 0 0 6.521-6.865 1.125 1.125 0 0 1 2.25 0c0 4.659-3.492 8.498-8 9.053v1.322h1.874l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H9a1.126 1.126 0 0 1 0-2.25h1.875v-1.322c-4.508-.555-7.999-4.395-7.999-9.053Z"
      />
      <path
        fill={color}
        d="M14.874 6a2.875 2.875 0 1 0-5.749 0v4.5a2.875 2.875 0 0 0 5.75 0zm2.25 4.5a5.124 5.124 0 0 1-10.249 0V6a5.126 5.126 0 0 1 10.25 0v4.5Z"
      />
    </svg>
  );
}
