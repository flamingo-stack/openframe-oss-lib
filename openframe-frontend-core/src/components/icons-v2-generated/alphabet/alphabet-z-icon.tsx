import type { SVGProps } from "react";
export interface AlphabetZIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetZIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetZIconProps) {
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
        d="M16.495 2.875c1.223 0 1.98 1.283 1.465 2.332l-.122.207-9.153 13.461H17l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H7.504c-1.304 0-2.077-1.46-1.344-2.538l9.152-13.462H7a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
