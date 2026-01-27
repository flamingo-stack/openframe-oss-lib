import type { SVGProps } from "react";
export interface GripVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GripVrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GripVrIconProps) {
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
        d="M9.391 18.382a1.375 1.375 0 1 1-1.509 1.509l-.007-.14.007-.141a1.375 1.375 0 0 1 1.368-1.235zm5.5 0a1.375 1.375 0 1 1-1.508 1.509l-.007-.14.007-.141a1.374 1.374 0 0 1 1.367-1.235zm-5.5-5.166a1.375 1.375 0 1 1-1.509 1.508l-.007-.14.007-.14a1.375 1.375 0 0 1 1.368-1.236zm5.5 0a1.375 1.375 0 1 1-1.508 1.508l-.007-.14.007-.14a1.374 1.374 0 0 1 1.367-1.236zm-5.5-5.166a1.375 1.375 0 1 1-1.509 1.508l-.007-.14.007-.141A1.375 1.375 0 0 1 9.25 8.042l.141.007Zm5.5 0a1.375 1.375 0 1 1-1.508 1.508l-.007-.14.007-.141a1.375 1.375 0 0 1 1.367-1.235l.14.007Zm-5.5-5.167A1.375 1.375 0 1 1 7.882 4.39l-.007-.14.007-.14A1.375 1.375 0 0 1 9.25 2.874zm5.5 0a1.375 1.375 0 1 1-1.508 1.508l-.007-.14.007-.14a1.375 1.375 0 0 1 1.367-1.236z"
      />
    </svg>
  );
}
