import type { SVGProps } from "react";
export interface AlphabetOIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetOIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetOIconProps) {
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
        d="M15.375 8.5a3.375 3.375 0 1 0-6.75 0v7a3.375 3.375 0 0 0 6.75 0zm2.25 7a5.625 5.625 0 0 1-11.25 0v-7a5.625 5.625 0 0 1 11.25 0z"
      />
    </svg>
  );
}
