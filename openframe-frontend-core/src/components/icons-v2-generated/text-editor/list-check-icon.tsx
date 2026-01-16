import type { SVGProps } from "react";
export interface ListCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ListCheckIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ListCheckIconProps) {
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
        d="M21 16.875a1.125 1.125 0 1 1 0 2.25h-9a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 1 1 0 2.25h-9a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 1 1 0 2.25h-9a1.125 1.125 0 0 1 0-2.25zM6.705 15.204a1.125 1.125 0 1 1 1.59 1.591l-3 3c-.439.44-1.151.44-1.59 0l-1.5-1.5-.078-.085a1.126 1.126 0 0 1 1.583-1.583l.085.078.705.704 2.205-2.204Zm0-6a1.125 1.125 0 1 1 1.59 1.591l-3 3c-.439.44-1.151.44-1.59 0l-1.5-1.5-.078-.085a1.126 1.126 0 0 1 1.583-1.583l.085.077.705.705zm0-6a1.125 1.125 0 1 1 1.59 1.591l-3 3c-.439.44-1.151.44-1.59 0l-1.5-1.5-.078-.085A1.125 1.125 0 0 1 3.71 4.627l.085.078.705.704z"
      />
    </svg>
  );
}
