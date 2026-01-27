import type { SVGProps } from "react";
export interface UserCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserCheckIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UserCheckIconProps) {
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
        d="M21.204 15.705a1.125 1.125 0 0 1 1.59 1.59l-4.5 4.5c-.438.44-1.15.44-1.59 0l-2-2-.077-.086a1.125 1.125 0 0 1 1.583-1.582l.085.078L17.5 19.41zm-8.347-1.83q.67 0 1.301.135l.415.102.108.038a1.125 1.125 0 0 1-.61 2.154l-.114-.027-.265-.066a4 4 0 0 0-.835-.086H7.143a4.014 4.014 0 0 0-4.005 3.75h8.895l.114.006a1.126 1.126 0 0 1 0 2.238l-.114.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm.269-6.625a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
