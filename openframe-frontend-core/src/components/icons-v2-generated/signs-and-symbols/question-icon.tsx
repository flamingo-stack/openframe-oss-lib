import type { SVGProps } from "react";
export interface QuestionIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function QuestionIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: QuestionIconProps) {
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
        d="M10.876 14.5v-1.6c0-.552.308-.933.502-1.126.203-.202.449-.367.649-.492.49-.307.842-.478 1.337-.818.871-.597 1.51-1.302 1.51-2.464 0-1.56-1.282-2.875-2.873-2.875-1.338 0-2.575.893-2.932 1.99a1.125 1.125 0 0 1-2.138-.698C7.617 4.308 9.782 2.875 12 2.875c2.852 0 5.124 2.34 5.124 5.125 0 2.25-1.36 3.545-2.49 4.319-.504.346-1.153.706-1.413.868q-.054.036-.096.065V14.5a1.125 1.125 0 0 1-2.25 0Zm.624 4.629a.62.62 0 0 0-.124.37l.011.127a.6.6 0 0 0 .113.244zm1 .741a.6.6 0 0 0 .112-.245l.013-.125-.013-.127a.6.6 0 0 0-.111-.244zm1.126-.37a1.625 1.625 0 0 1-3.242.167l-.009-.168.009-.165a1.625 1.625 0 0 1 1.615-1.459l.167.009c.82.083 1.46.774 1.46 1.616"
      />
    </svg>
  );
}
