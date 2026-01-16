import type { SVGProps } from "react";
export interface MagicWandIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MagicWandIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MagicWandIconProps) {
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
        d="M18.875 20v-.875H18a1.125 1.125 0 0 1 0-2.25h.875V16a1.125 1.125 0 0 1 2.25 0v.875H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-.875V20a1.125 1.125 0 1 1-2.25 0M10.632 7.633a1.126 1.126 0 0 1 1.506-.077l.087.077 4.142 4.143.078.085a1.126 1.126 0 0 1-1.584 1.583l-.085-.077-4.144-4.143-.076-.085a1.125 1.125 0 0 1 .076-1.506m-7.757 2.368v-.877H2a1.125 1.125 0 0 1 0-2.25h.875V6a1.125 1.125 0 0 1 2.25 0v.875H6l.114.005a1.126 1.126 0 0 1 0 2.239L6 9.124h-.876v.877a1.125 1.125 0 0 1-2.25 0Zm8.128-8.126.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-.006a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M16.697 1.591a3.2 3.2 0 0 1 4.279.22l1.213 1.214.22.242a3.2 3.2 0 0 1 0 4.036l-.22.243L7.546 22.189a3.197 3.197 0 0 1-4.52 0L1.81 20.976a3.197 3.197 0 0 1 0-4.52L16.455 1.81zm2.688 1.81a.95.95 0 0 0-1.191-.12l-.148.12L3.402 18.047c-.37.37-.37.97 0 1.339l1.214 1.213c.37.37.97.37 1.34 0L20.597 5.955l.121-.15a.95.95 0 0 0 0-1.04l-.121-.149-1.213-1.214Z"
      />
    </svg>
  );
}
