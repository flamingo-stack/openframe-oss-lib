import type { SVGProps } from "react";
export interface RedditLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RedditLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RedditLogoIconProps) {
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
        d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m4.495 4.06a1 1 0 0 0-1.225.43L12.82 6a.31.31 0 0 0-.322.128.3.3 0 0 0-.048.112l-.74 3.47a7.14 7.14 0 0 0-3.9 1.23 1.462 1.462 0 0 0-2.211.248A1.46 1.46 0 0 0 6.2 13.33a3 3 0 0 0-.006.33l.006.11c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a3 3 0 0 0 .006-.33l-.006-.11a1.46 1.46 0 0 0 .81-1.33 1.46 1.46 0 0 0-2.47-1 7.1 7.1 0 0 0-3.85-1.23L13 6.65l2.14.45a1 1 0 1 0 1.355-1.04m-6.76 9.249a.27.27 0 0 1 .185.061 3.26 3.26 0 0 0 1.527.607q.276.035.553.023a3.28 3.28 0 0 0 2.09-.61.33.33 0 0 1 .2-.07.27.27 0 0 1 .184.463l.006-.033a3.84 3.84 0 0 1-2.14.77h-.66a3.8 3.8 0 0 1-2.14-.77.27.27 0 0 1 .195-.441m3.858-2.976a1 1 0 0 1 1.707.707 1 1 0 0 1-1.01 1.04l.01-.04a1 1 0 0 1-.707-1.707m-4.306-.257a1 1 0 1 1 .765 1.849 1 1 0 0 1-.765-1.849"
      />
    </svg>
  );
}
