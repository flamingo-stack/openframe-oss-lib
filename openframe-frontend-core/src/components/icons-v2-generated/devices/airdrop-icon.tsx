import type { SVGProps } from "react";
export interface AirdropIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AirdropIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AirdropIconProps) {
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
        d="M6.415 16.552a1.125 1.125 0 0 1-1.596 1.586zm12.766 1.586a1.126 1.126 0 0 1-1.596-1.586zM19.875 11a7.875 7.875 0 1 0-13.46 5.552l-.799.792-.797.794A10.1 10.1 0 0 1 1.875 11C1.875 5.408 6.408.875 12 .875S22.125 5.408 22.125 11a10.1 10.1 0 0 1-2.944 7.138l-.797-.794-.799-.792A7.85 7.85 0 0 0 19.875 11m-4 0a3.874 3.874 0 1 0-7.13 2.104l.243.345a1.127 1.127 0 0 1-1.777 1.363l-.074-.088-.282-.399a6.124 6.124 0 1 1 10.008.398l-.074.088a1.126 1.126 0 0 1-1.711-1.456l.177-.252c.392-.605.62-1.326.62-2.103m-3.658-2.114a2.126 2.126 0 1 1-2.33 2.33L9.874 11l.011-.218A2.125 2.125 0 0 1 12 8.875z"
      />
      <path
        fill={color}
        d="M10.53 15.505a2.03 2.03 0 0 1 2.94 0l.159.192 2.662 3.66c.903 1.243-.106 2.767-1.45 2.767H9.159c-1.343 0-2.353-1.524-1.45-2.767l2.663-3.66zm-.415 4.37h3.77L12 17.281l-1.885 2.592Z"
      />
    </svg>
  );
}
