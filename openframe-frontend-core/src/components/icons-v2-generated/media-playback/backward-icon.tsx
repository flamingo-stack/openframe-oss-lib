import type { SVGProps } from "react";
export interface BackwardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BackwardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BackwardIconProps) {
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
        d="M11.576 12.969a1.125 1.125 0 0 1 1.564-.284l7.44 5.155a.188.188 0 0 0 .295-.154V6.316a.188.188 0 0 0-.246-.18l-.049.024-7.44 5.155-.096.062a1.126 1.126 0 0 1-1.184-1.912l7.44-5.153.153-.099c1.6-.948 3.673.197 3.673 2.103v11.37c0 1.966-2.21 3.124-3.826 2.004l-7.439-5.155a1.125 1.125 0 0 1-.284-1.566Z"
      />
      <path
        fill={color}
        d="M11.375 6.316a.188.188 0 0 0-.246-.18l-.049.024-7.686 5.326a.626.626 0 0 0 0 1.029l7.686 5.325a.188.188 0 0 0 .295-.154zm2.25 11.37c0 1.966-2.21 3.124-3.826 2.004l-7.686-5.327c-1.65-1.143-1.65-3.583 0-4.727l7.686-5.324c1.616-1.12 3.826.037 3.826 2.004z"
      />
    </svg>
  );
}
