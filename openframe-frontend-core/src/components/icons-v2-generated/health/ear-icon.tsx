import type { SVGProps } from "react";
export interface EarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EarIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EarIconProps) {
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
        d="M11.987.875c4.57 0 7.704 3.734 8.108 8.02.213 2.255-.738 3.918-1.862 5.312-.547.678-1.182 1.348-1.744 1.97a19 19 0 0 0-1.395 1.699 5.61 5.61 0 0 1-5.601 5.248A5.62 5.62 0 0 1 3.875 17.5V9c0-4.485 3.63-8.125 8.112-8.125M6.125 17.5a3.37 3.37 0 0 0 3.368 3.375 3.36 3.36 0 0 0 3.366-3.375c0-.222.066-.439.189-.623.547-.822 1.175-1.549 1.772-2.209.615-.68 1.169-1.26 1.663-1.874.96-1.19 1.506-2.276 1.372-3.688-.321-3.411-2.72-5.981-5.868-5.981-3.235 0-5.862 2.629-5.862 5.875z"
      />
      <path
        fill={color}
        d="M13.875 9a1.875 1.875 0 0 0-3.75 0v1.534l.964.964.145.16a2.125 2.125 0 0 1 0 2.683l-.145.161-1.294 1.293a1.125 1.125 0 1 1-1.59-1.59l1.204-1.206-.911-.911a2.13 2.13 0 0 1-.623-1.502V9a4.125 4.125 0 1 1 8.25 0 1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
