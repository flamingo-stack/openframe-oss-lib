import type { SVGProps } from "react";
export interface ChatXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChatXmarkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChatXmarkIconProps) {
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
        d="M4.133 4.133c4.344-4.345 11.39-4.345 15.734 0s4.344 11.39 0 15.734c-3.477 3.477-8.68 4.17-12.847 2.084l-3.17.762c-1.543.37-2.933-1.02-2.563-2.562l.76-3.173C-.037 12.812.657 7.609 4.133 4.133m14.143 1.592a8.875 8.875 0 0 0-12.55 0 8.88 8.88 0 0 0-1.5 10.562c.136.245.175.534.109.807l-.813 3.382 3.385-.811.207-.03c.207-.01.415.038.599.14a8.875 8.875 0 0 0 10.563-14.05"
      />
      <path
        fill={color}
        d="M14.705 7.705a1.125 1.125 0 0 1 1.591 1.59L13.59 12l2.706 2.706.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076L12 13.59l-2.704 2.706a1.125 1.125 0 0 1-1.591-1.59l2.704-2.707-2.704-2.704-.078-.085a1.125 1.125 0 0 1 1.584-1.583l.085.078L12 10.409z"
      />
    </svg>
  );
}
