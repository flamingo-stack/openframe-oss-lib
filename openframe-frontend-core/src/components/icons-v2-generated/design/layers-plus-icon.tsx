import type { SVGProps } from "react";
export interface LayersPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LayersPlusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LayersPlusIconProps) {
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
        d="M19.668 17.09a1.125 1.125 0 0 1 1.484-.57 1.614 1.614 0 0 1 0 2.961l-7.343 3.262a4.47 4.47 0 0 1-3.618 0l-7.344-3.262a1.614 1.614 0 0 1 0-2.962l.107-.04a1.125 1.125 0 0 1 1.46 1.236l6.69 2.972.218.082a2.22 2.22 0 0 0 1.573-.082l6.69-2.972a1.1 1.1 0 0 1 .083-.624Zm.826.909-.255.577.458-1.028z"
      />
      <path
        fill={color}
        d="M10.19 8.258a4.47 4.47 0 0 1 3.619 0l7.343 3.262.229.122a1.613 1.613 0 0 1-.229 2.838l-7.343 3.263a4.47 4.47 0 0 1-3.618 0L2.847 14.48a1.613 1.613 0 0 1 0-2.961zm2.705 2.055a2.22 2.22 0 0 0-1.79 0l-6.05 2.686 6.05 2.687.217.084a2.22 2.22 0 0 0 1.573-.084l6.048-2.687zM17.875 8V6.125H16a1.125 1.125 0 1 1 0-2.25h1.875V2a1.125 1.125 0 1 1 2.25 0v1.875H22l.114.006a1.126 1.126 0 0 1 0 2.238L22 6.125h-1.875V8a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
