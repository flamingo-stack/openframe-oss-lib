import type { SVGProps } from "react";
export interface PackagePlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PackagePlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PackagePlusIconProps) {
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
        d="M18.875 12.125V8.412l-6.75 3.75v7.415a1.123 1.123 0 0 1 .757 2.096 4.12 4.12 0 0 1-3.627.067l-.234-.118-6-3.28a4.13 4.13 0 0 1-2.146-3.62V8.28c0-.705.182-1.381.508-1.978a1.1 1.1 0 0 1 .17-.285A4.1 4.1 0 0 1 3.021 4.66l6-3.28.234-.118a4.13 4.13 0 0 1 3.724.118l6 3.28.242.144c.5.319.915.738 1.23 1.221a1.1 1.1 0 0 1 .166.277c.326.597.508 1.273.508 1.978v3.845a1.125 1.125 0 0 1-2.25 0m-6.976-8.77a1.88 1.88 0 0 0-1.583-.101l-.215.101-5.772 3.154L11 10.213l6.67-3.704-5.77-3.154ZM3.125 14.722c0 .686.374 1.316.976 1.645l5.774 3.155v-7.36l-6.75-3.75z"
      />
      <path
        fill={color}
        d="M17.875 22v-1.875H16a1.125 1.125 0 0 1 0-2.25h1.875V16a1.125 1.125 0 0 1 2.25 0v1.875H22a1.125 1.125 0 0 1 0 2.25h-1.875V22a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
