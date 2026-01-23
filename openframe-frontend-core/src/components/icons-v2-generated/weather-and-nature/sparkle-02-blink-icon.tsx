import type { SVGProps } from "react";
export interface Sparkle02BlinkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Sparkle02BlinkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Sparkle02BlinkIconProps) {
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
        d="M4.705 17.704a1.125 1.125 0 0 1 1.59 1.591l-2.5 2.5a1.125 1.125 0 1 1-1.59-1.59l2.5-2.5Zm13 0a1.125 1.125 0 0 1 1.505-.076l.085.076 2.5 2.5.078.086a1.125 1.125 0 0 1-1.584 1.583l-.084-.078-2.5-2.5-.077-.085a1.125 1.125 0 0 1 .076-1.506Zm-15.5-15.5a1.125 1.125 0 0 1 1.505-.077l.085.078 2.5 2.5.077.085A1.125 1.125 0 0 1 4.79 6.372l-.085-.076-2.5-2.5-.078-.085a1.125 1.125 0 0 1 .078-1.506Zm18 0a1.125 1.125 0 1 1 1.59 1.591l-2.5 2.501a1.125 1.125 0 0 1-1.59-1.59l2.5-2.501Z"
      />
      <path
        fill={color}
        d="M10.659 1.902c.346-1.37 2.335-1.37 2.682 0l.03.14.112.71.067.372a9.36 9.36 0 0 0 7.698 7.393l.709.114c1.508.242 1.556 2.351.142 2.71l-.142.03-.709.112a9.36 9.36 0 0 0-7.765 7.765l-.113.71c-.25 1.556-2.49 1.556-2.74 0l-.113-.71a9.36 9.36 0 0 0-7.393-7.698l-.373-.067-.709-.113c-1.556-.25-1.556-2.49 0-2.74l.71-.113.372-.068a9.36 9.36 0 0 0 7.393-7.697l.114-.71zM12 5.715A11.62 11.62 0 0 1 5.716 12 11.62 11.62 0 0 1 12 18.283a11.62 11.62 0 0 1 6.282-6.282A11.62 11.62 0 0 1 12 5.715"
      />
    </svg>
  );
}
