import type { SVGProps } from "react";
export interface AlphabetMIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetMIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetMIconProps) {
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
        d="M17.875 20V5.588l-4.39 9.846c-.573 1.285-2.397 1.285-2.97 0l-4.39-9.85v14.418a1.126 1.126 0 0 1-2.25 0V4.999c0-2.222 2.94-2.918 3.973-1.054l.093.188L12 13.238l4.06-9.105.094-.188c1.033-1.863 3.972-1.168 3.972 1.054v15.002a1.126 1.126 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
