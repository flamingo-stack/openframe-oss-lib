import type { SVGProps } from "react";
export interface Sort91UpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Sort91UpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Sort91UpIconProps) {
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
        d="M17.705 13.705a1.125 1.125 0 0 1 1.92.796v5.374H21l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-5a1.125 1.125 0 1 1 0-2.25h1.375v-2.66l-.08.08a1.125 1.125 0 0 1-1.59-1.59zm2.17-8.204a1.375 1.375 0 1 0-2.75-.001 1.375 1.375 0 0 0 2.75 0Zm2.25 0a3.6 3.6 0 0 1-.491 1.814q-.022.045-.047.087l-2.634 4.197a1.126 1.126 0 0 1-1.906-1.197l.837-1.333a3.622 3.622 0 0 1 .616-7.194 3.625 3.625 0 0 1 3.625 3.626M5.875 21V5.716l-2.08 2.08a1.125 1.125 0 0 1-1.59-1.59l4-4.001.085-.078a1.126 1.126 0 0 1 1.506.078l3.999 4 .078.085a1.125 1.125 0 0 1-1.582 1.582l-.087-.076-2.079-2.08V21a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
