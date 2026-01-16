import type { SVGProps } from "react";
export interface PackageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PackageIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PackageIconProps) {
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
        d="m19.875 8.91-6.75 3.75v7.361l5.774-3.155.214-.136c.475-.35.762-.909.762-1.509v-6.31Zm-6.976-5.056a1.88 1.88 0 0 0-1.583-.101l-.215.101-5.772 3.154L12 10.712l6.67-3.704-5.77-3.154ZM4.125 15.221c0 .686.374 1.316.976 1.645l5.774 3.155v-7.36l-6.75-3.75zm18 0a4.13 4.13 0 0 1-2.146 3.62l-6 3.28a4.13 4.13 0 0 1-3.724.118l-.234-.118-6-3.28a4.13 4.13 0 0 1-2.146-3.62V8.78c0-.705.182-1.381.508-1.978a1.1 1.1 0 0 1 .17-.285A4.1 4.1 0 0 1 4.021 5.16l6-3.28.234-.118a4.13 4.13 0 0 1 3.724.118l6 3.28.242.144c.5.319.915.738 1.23 1.221a1.1 1.1 0 0 1 .166.277c.326.597.508 1.273.508 1.978v6.442Z"
      />
    </svg>
  );
}
