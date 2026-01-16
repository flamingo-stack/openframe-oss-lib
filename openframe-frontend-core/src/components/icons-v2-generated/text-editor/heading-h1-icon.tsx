import type { SVGProps } from "react";
export interface HeadingH1IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingH1Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HeadingH1IconProps) {
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
        d="M19.82 10.877A1.125 1.125 0 0 1 20.875 12v6.875H22l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006h-4.5a1.125 1.125 0 0 1 0-2.25h1.125v-3.882a3 3 0 0 1-.598.118l-.293.013H17.5a1.125 1.125 0 0 1 0-2.25h.234l.161-.014a.875.875 0 0 0 .708-.752l.03-.247a1.126 1.126 0 0 1 1.187-.985ZM11.874 20v-6.876H3.125V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.25 0v6.874h8.75V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
