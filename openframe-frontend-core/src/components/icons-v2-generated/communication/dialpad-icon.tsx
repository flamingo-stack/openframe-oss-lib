import type { SVGProps } from "react";
export interface DialpadIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DialpadIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: DialpadIconProps) {
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
        d="M12.626 19.25a.625.625 0 1 0-1.25.002.625.625 0 0 0 1.25-.002M5.375 12a.625.625 0 1 0-1.25 0 .625.625 0 0 0 1.25 0m14.5 0a.626.626 0 1 0-1.252 0 .626.626 0 0 0 1.252 0m-7.25-7.25a.626.626 0 1 0-1.251.001.626.626 0 0 0 1.252 0Zm2.25 14.5a2.876 2.876 0 1 1-5.751-.001 2.876 2.876 0 0 1 5.752 0ZM7.626 12a2.875 2.875 0 1 1-5.75.001A2.875 2.875 0 0 1 7.625 12Zm14.5 0a2.876 2.876 0 1 1-5.752 0 2.876 2.876 0 0 1 5.752 0m-7.25-7.25a2.875 2.875 0 1 1-5.75-.001 2.875 2.875 0 0 1 5.75.001M12.626 12a.626.626 0 1 0-1.252 0 .626.626 0 0 0 1.252 0M5.375 4.75a.625.625 0 1 0-1.25 0 .625.625 0 0 0 1.25 0m14.5 0a.626.626 0 1 0-1.252.001.626.626 0 0 0 1.252 0Zm-5 7.25a2.876 2.876 0 1 1-5.751 0 2.876 2.876 0 0 1 5.752 0Zm-7.25-7.25a2.874 2.874 0 1 1-5.749 0 2.874 2.874 0 0 1 5.749 0m14.5 0a2.875 2.875 0 1 1-5.75-.001 2.875 2.875 0 0 1 5.75.001"
      />
    </svg>
  );
}
