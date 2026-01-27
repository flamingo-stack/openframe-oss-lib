import type { SVGProps } from "react";
export interface TubeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TubeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TubeIconProps) {
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
        d="M6.874 19v-2a1.126 1.126 0 0 1 2.25 0v2c0 1.035.84 1.875 1.875 1.875H13c1.036 0 1.875-.84 1.875-1.875v-2a1.125 1.125 0 0 1 2.25 0v2A4.126 4.126 0 0 1 13 23.125h-2A4.126 4.126 0 0 1 6.873 19ZM17.85 4.875l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H6.15a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M16 .875a3.126 3.126 0 0 1 3.124 3.029l-.009.337-.923 11.922a2.125 2.125 0 0 1-2.118 1.962H7.925a2.126 2.126 0 0 1-2.093-1.757l-.025-.205-.923-11.922A3.126 3.126 0 0 1 8 .875zm-8 2.25c-.51 0-.91.434-.872.942l.913 11.808h7.917l.914-11.808-.006-.186A.875.875 0 0 0 16 3.125z"
      />
    </svg>
  );
}
