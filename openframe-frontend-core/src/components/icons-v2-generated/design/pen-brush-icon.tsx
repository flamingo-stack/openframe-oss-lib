import type { SVGProps } from "react";
export interface PenBrushIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PenBrushIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PenBrushIconProps) {
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
        d="M10.814 7.814a1.126 1.126 0 0 1 1.506-.077l.085.077 3.782 3.782.078.085a1.126 1.126 0 0 1-1.584 1.584l-.085-.078-3.782-3.782-.078-.085a1.125 1.125 0 0 1 .078-1.506"
      />
      <path
        fill={color}
        d="M11.146 16.364q-.001-.482-.127-.923c-.327-1.151-1.263-2.088-2.481-2.439a3.8 3.8 0 0 0-1.061-.148c-1.96 0-3.351 1.505-3.352 3.51 0 1.847-.734 2.8-.997 3.427a.1.1 0 0 0-.003.029.14.14 0 0 0 .019.054l.001.002h4.332c2.062 0 3.67-1.608 3.67-3.512ZM20.231 3.77a2.2 2.2 0 0 0-3.247.147l-6.327 7.591a5.86 5.86 0 0 1 1.849 1.823l7.577-6.314a2.2 2.2 0 0 0 .148-3.247m-6.835 12.594c0 3.217-2.686 5.761-5.919 5.761H3.109c-1.723 0-2.634-1.83-2.055-3.206.472-1.124.821-1.312.821-2.555 0-3.114 2.269-5.76 5.602-5.76q.481.001.943.075l6.835-8.203.161-.183a4.45 4.45 0 0 1 6.406-.114l.167.177a4.45 4.45 0 0 1-.464 6.39l-8.186 6.819q.057.392.057.8Z"
      />
    </svg>
  );
}
