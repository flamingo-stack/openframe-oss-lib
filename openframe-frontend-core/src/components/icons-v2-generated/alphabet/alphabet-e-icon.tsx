import type { SVGProps } from "react";
export interface AlphabetEIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetEIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetEIconProps) {
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
        d="M16.5 2.875a1.125 1.125 0 0 1 0 2.25H8.625v5.25h6.874l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H8.625v6.25H16.5l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H8A1.626 1.626 0 0 1 6.375 19.5v-15c0-.898.727-1.625 1.625-1.625z"
      />
    </svg>
  );
}
