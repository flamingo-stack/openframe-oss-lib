import type { SVGProps } from "react";
export interface CrosshairOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CrosshairOffIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CrosshairOffIconProps) {
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
        d="M20.414 13.906a1.126 1.126 0 0 1-2.196-.495zM10.874 2a1.125 1.125 0 0 1 2.25 0v1.45a8.625 8.625 0 0 1 7.426 7.425H22l.114.006a1.125 1.125 0 0 1 0 2.239l-.114.006h-1.45a9 9 0 0 1-.136.78l-2.196-.495a6.375 6.375 0 0 0-7.627-7.63 1.125 1.125 0 1 1-.496-2.195q.384-.084.78-.136zm.002 20v-1.45a8.624 8.624 0 0 1-7.426-7.424H2a1.125 1.125 0 0 1 0-2.25h1.45a8.6 8.6 0 0 1 1.708-4.125L2.205 3.795l-.078-.085A1.125 1.125 0 0 1 3.71 2.127l.087.078 18 18 .076.085a1.125 1.125 0 0 1-1.582 1.583l-.085-.078-2.956-2.956a8.6 8.6 0 0 1-4.123 1.71V22a1.126 1.126 0 0 1-2.25 0ZM6.766 8.358a6.375 6.375 0 0 0 8.874 8.873l-1.631-1.632a4.1 4.1 0 0 1-2.008.526A4.125 4.125 0 0 1 8.398 9.99L6.767 8.358ZM10.127 12c0 1.036.839 1.875 1.875 1.875.089 0 .176-.01.262-.022l-2.118-2.117a2 2 0 0 0-.02.264Z"
      />
    </svg>
  );
}
