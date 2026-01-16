import type { SVGProps } from "react";
export interface Sparkle02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Sparkle02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Sparkle02IconProps) {
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
        d="M10.659 1.902c.346-1.37 2.335-1.37 2.682 0l.03.14.112.71.067.372a9.36 9.36 0 0 0 7.698 7.393l.709.114c1.508.242 1.556 2.351.142 2.71l-.142.03-.709.112a9.36 9.36 0 0 0-7.765 7.765l-.113.71c-.25 1.556-2.49 1.556-2.74 0l-.113-.71a9.36 9.36 0 0 0-7.393-7.698l-.373-.067-.709-.113c-1.556-.25-1.556-2.49 0-2.74l.71-.113.372-.068a9.36 9.36 0 0 0 7.393-7.697l.114-.71zM12 5.715A11.62 11.62 0 0 1 5.716 12 11.62 11.62 0 0 1 12 18.283a11.62 11.62 0 0 1 6.282-6.282A11.62 11.62 0 0 1 12 5.715"
      />
    </svg>
  );
}
