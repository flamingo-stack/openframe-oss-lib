import type { SVGProps } from "react";
export interface CheckboxCheckmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CheckboxCheckmarkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CheckboxCheckmarkIconProps) {
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
        d="M19.6032 1.069C20.3385 -0.0339 21.8285 -0.3319 22.9314 0.4033C24.0343 1.1386 24.3322 2.6286 23.597 3.7315L11.6603 21.6377C10.4338 23.4774 7.8861 23.7644 6.2814 22.3408L5.9743 22.0338L0.6071 15.994L0.4524 15.8041C-0.2603 14.8179 -0.1226 13.433 0.8063 12.6072C1.797 11.7266 3.3125 11.8158 4.1931 12.8065L8.5267 17.6815L19.6032 1.069Z"
      />
    </svg>
  );
}
