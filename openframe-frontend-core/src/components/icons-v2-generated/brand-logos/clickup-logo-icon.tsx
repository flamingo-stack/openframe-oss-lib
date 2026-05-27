import type { SVGProps } from "react";
export interface ClickupLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClickupLogoIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ClickupLogoIconProps) {
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
        fill="url(#clickup-logo_svg__a)"
        fillRule="evenodd"
        d="m4 17.366 3.069-2.356c1.63 2.132 3.361 3.116 5.29 3.116 1.917 0 3.6-.972 5.156-3.088l3.112 2.3C18.38 20.388 15.59 22 12.358 22 9.137 22 6.318 20.4 4 17.366"
        clipRule="evenodd"
      />
      <path
        fill="url(#clickup-logo_svg__b)"
        fillRule="evenodd"
        d="m12.185 7.126-5.46 4.717L4.2 8.908 12.197 2l7.934 6.913-2.536 2.925z"
        clipRule="evenodd"
      />
      <defs>
        <linearGradient
          id="clickup-logo_svg__a"
          x1={4}
          x2={20.627}
          y1={19.764}
          y2={19.764}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8930FD" />
          <stop offset={1} stopColor="#49CCF9" />
        </linearGradient>
        <linearGradient
          id="clickup-logo_svg__b"
          x1={4.2}
          x2={20.131}
          y1={8.694}
          y2={8.694}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FF02F0" />
          <stop offset={1} stopColor="#FFC800" />
        </linearGradient>
      </defs>
    </svg>
  );
}
