import type { SVGProps } from "react";
export interface PackageMinusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PackageMinusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PackageMinusIconProps) {
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
        d="M18.875 14.722v-6.31l-6.75 3.75v7.416a1.12 1.12 0 0 1 1.244.582 1.126 1.126 0 0 1-.488 1.514 4.13 4.13 0 0 1-3.626.066l-.234-.118-6-3.28a4.13 4.13 0 0 1-2.146-3.62V8.28c0-.705.182-1.381.508-1.978a1.1 1.1 0 0 1 .17-.285A4.1 4.1 0 0 1 3.021 4.66l6-3.28.234-.118a4.13 4.13 0 0 1 3.724.118l6 3.28.242.144c.5.319.915.738 1.23 1.221a1.1 1.1 0 0 1 .166.277c.326.597.508 1.273.508 1.978v6.442q0 .196-.018.388a1.125 1.125 0 0 1-2.24-.21 2 2 0 0 0 .008-.178M11.899 3.355a1.88 1.88 0 0 0-1.583-.101l-.215.101-5.772 3.154L11 10.213l6.67-3.704-5.77-3.154ZM3.125 14.722c0 .686.374 1.316.976 1.645l5.774 3.155v-7.36l-6.75-3.75z"
      />
      <path
        fill={color}
        d="M22 17.875a1.125 1.125 0 0 1 0 2.25h-6a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
