import type { SVGProps } from "react";
export interface AndroidIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AndroidIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AndroidIconProps) {
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
        d="M7.375 22v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m7 0v-3a1.126 1.126 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m-12.5-5v-6a1.125 1.125 0 0 1 2.25 0v6a1.125 1.125 0 0 1-2.25 0m18 0v-6a1.125 1.125 0 0 1 2.25 0v6a1.125 1.125 0 0 1-2.25 0M7.205 1.205a1.126 1.126 0 0 1 1.505-.078l.085.078 2.257 2.257.078.085A1.126 1.126 0 0 1 9.546 5.13l-.085-.077-2.257-2.258-.076-.085a1.125 1.125 0 0 1 .076-1.505Zm8 0a1.125 1.125 0 0 1 1.59 1.59L14.54 5.053a1.125 1.125 0 0 1-1.591-1.591z"
      />
      <path
        fill={color}
        d="M7.125 17.875h9.75v-5.75h-9.75zM12 5.125a4.874 4.874 0 0 0-4.872 4.75h9.744A4.874 4.874 0 0 0 12 5.125M19.125 18A2.126 2.126 0 0 1 17 20.125H7A2.126 2.126 0 0 1 4.875 18v-8a7.125 7.125 0 1 1 14.25 0z"
      />
    </svg>
  );
}
