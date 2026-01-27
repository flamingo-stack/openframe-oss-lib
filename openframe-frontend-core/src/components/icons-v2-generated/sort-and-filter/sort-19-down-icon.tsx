import type { SVGProps } from "react";
export interface Sort19DownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Sort19DownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Sort19DownIconProps) {
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
        d="M19.875 15.5a1.374 1.374 0 1 0-2.749 0 1.374 1.374 0 0 0 2.748 0Zm-2.17-13.295a1.126 1.126 0 0 1 1.92.795v5.374H21l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005h-5a1.125 1.125 0 0 1 0-2.25h1.375v-2.66l-.08.08a1.125 1.125 0 1 1-1.59-1.59zm4.42 13.294a3.6 3.6 0 0 1-.493 1.82q-.02.041-.045.082l-2.634 4.197-.066.095a1.126 1.126 0 0 1-1.84-1.29l.837-1.335a3.622 3.622 0 0 1 .616-7.193 3.624 3.624 0 0 1 3.625 3.624M5.875 3v15.284l-2.08-2.08a1.125 1.125 0 0 0-1.59 1.59l4 4.001.171.141a1.126 1.126 0 0 0 1.42-.14l3.999-4.001.078-.085a1.125 1.125 0 0 0-1.582-1.582l-.087.076-2.079 2.08V3a1.125 1.125 0 0 0-2.25 0"
      />
    </svg>
  );
}
