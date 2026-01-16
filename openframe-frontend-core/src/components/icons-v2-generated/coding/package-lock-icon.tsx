import type { SVGProps } from "react";
export interface PackageLockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PackageLockIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PackageLockIconProps) {
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
        d="M18.875 10.086V8.413l-6.75 3.749v7.555a1.122 1.122 0 0 1 .246 2.176l-.337.102a4 4 0 0 1-1.034.132l-.255-.007a4.1 4.1 0 0 1-1.49-.38l-.234-.118-6-3.28a4.13 4.13 0 0 1-2.146-3.62V8.28c0-.705.182-1.381.508-1.978a1.1 1.1 0 0 1 .17-.285A4.1 4.1 0 0 1 3.021 4.66l6-3.28.234-.118a4.13 4.13 0 0 1 3.724.118l6 3.28.242.144c.5.319.915.738 1.23 1.221a1.1 1.1 0 0 1 .166.277c.326.597.508 1.273.508 1.978v1.806a1.125 1.125 0 0 1-2.25 0m-6.976-6.731a1.88 1.88 0 0 0-1.583-.101l-.215.101-5.772 3.154L11 10.213l6.67-3.704-5.77-3.154ZM3.125 14.722c0 .686.374 1.316.976 1.645l5.774 3.155v-7.36l-6.75-3.749v6.31Z"
      />
      <path
        fill={color}
        d="M17.125 20.875h3.75v-1.75h-3.75zm2.5-5.124a.626.626 0 0 0-1.25 0v1.124h1.25zm2.25 1.313A2.12 2.12 0 0 1 23.125 19v2A2.125 2.125 0 0 1 21 23.125h-4A2.125 2.125 0 0 1 14.875 21v-2c0-.862.513-1.602 1.25-1.936v-1.313a2.876 2.876 0 0 1 5.75 0z"
      />
    </svg>
  );
}
