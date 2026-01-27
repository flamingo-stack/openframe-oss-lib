import type { SVGProps } from "react";
export interface DrawingCompassIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DrawingCompassIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DrawingCompassIconProps) {
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
        d="M6.04 22.43a1.126 1.126 0 0 1-2.08-.86zm14-.86a1.125 1.125 0 0 1-2.08.86zM9.22 8.875a1.125 1.125 0 0 1 2.03.963L6.04 22.43 5 22l-1.04-.43L9.17 8.98l.05-.104Zm4.14-.506a1.124 1.124 0 0 1 1.42.506l.049.104 5.21 12.591L19 22l-1.038.43-5.21-12.592-.04-.108a1.125 1.125 0 0 1 .649-1.36ZM10.875 4V2a1.125 1.125 0 1 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M10.875 20.5v-.423a14.07 14.07 0 0 1-8.168-3.44l-.486-.445-.08-.084a1.125 1.125 0 0 1 1.55-1.614l.088.075.409.375a11.8 11.8 0 0 0 6.687 2.876v-.32a1.125 1.125 0 1 1 2.25 0v.32a11.83 11.83 0 0 0 7.096-3.251 1.125 1.125 0 0 1 1.558 1.623 14.08 14.08 0 0 1-8.654 3.885v.423a1.125 1.125 0 0 1-2.25 0m3-13.5a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
    </svg>
  );
}
