import type { SVGProps } from "react";
export interface BloodPressureIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BloodPressureIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BloodPressureIconProps) {
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
        d="M2.875 14v-.547c0-2.884 1.349-5.467 2.883-7.484C7.3 3.94 9.117 2.371 10.245 1.49a2.83 2.83 0 0 1 3.51 0c1.833 1.433 5.71 4.853 6.966 9.198a1.125 1.125 0 0 1-2.162.626c-1.042-3.604-4.392-6.645-6.19-8.052a.58.58 0 0 0-.737 0c-1.048.82-2.702 2.254-4.084 4.07-1.39 1.829-2.423 3.936-2.423 6.122V14c0 3.63 3.094 6.876 6.874 6.876 2.122 0 4.038-1.02 5.312-2.585l.872.71.873.71c-1.66 2.04-4.196 3.415-7.057 3.415-5.056 0-9.124-4.287-9.124-9.126m14.436 4.29a1.125 1.125 0 0 1 1.745 1.42z"
      />
      <path
        fill={color}
        d="M13.446 18.123c.445.022.862-.222 1.06-.62l1.243-2.486.245.486.08.136c.208.302.553.486.926.486h3l.116-.005a1.126 1.126 0 0 0 0-2.239L20 13.875h-2.304l-.94-1.877a1.126 1.126 0 0 0-2.012 0l-1.11 2.219-1.584-4.12a1.125 1.125 0 0 0-2.118.048l-1.244 3.73H8a1.125 1.125 0 0 0 0 2.25h1.5l.179-.014c.408-.066.755-.353.889-.755l.507-1.523 1.375 3.571.07.15c.189.333.537.55.926.57Z"
      />
    </svg>
  );
}
