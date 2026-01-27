import type { SVGProps } from "react";
export interface PackageXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PackageXmarkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PackageXmarkIconProps) {
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
        d="M18.875 13.527V8.412l-6.75 3.75v7.36l.838-.457.104-.05a1.126 1.126 0 0 1 .976 2.025l-1.064.582a4.13 4.13 0 0 1-3.724.118l-.234-.118-6-3.28a4.13 4.13 0 0 1-2.146-3.62V8.28c0-.705.182-1.381.508-1.978a1.1 1.1 0 0 1 .17-.285A4.1 4.1 0 0 1 3.021 4.66l6-3.28.234-.118a4.13 4.13 0 0 1 3.724.118l6 3.28.242.144c.5.319.915.738 1.23 1.221a1.1 1.1 0 0 1 .166.277c.326.597.508 1.273.508 1.978v5.247a1.125 1.125 0 0 1-2.25 0M11.899 3.355a1.88 1.88 0 0 0-1.583-.101l-.215.101-5.772 3.154L11 10.213l6.67-3.704-5.77-3.154ZM3.125 14.722c0 .686.374 1.316.976 1.645l5.774 3.155v-7.36l-6.75-3.75z"
      />
      <path
        fill={color}
        d="M21.204 16.205a1.125 1.125 0 0 1 1.59 1.59L21.09 19.5l1.705 1.705.078.087a1.124 1.124 0 0 1-1.582 1.581l-.087-.077L19.5 21.09l-1.704 1.705a1.125 1.125 0 1 1-1.59-1.59l1.703-1.706-1.703-1.704-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 1.704 1.703z"
      />
    </svg>
  );
}
