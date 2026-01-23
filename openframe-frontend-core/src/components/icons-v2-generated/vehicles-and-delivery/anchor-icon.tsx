import type { SVGProps } from "react";
export interface AnchorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AnchorIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AnchorIconProps) {
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
        d="M10.875 9a1.125 1.125 0 0 1 2.25 0v11.64c1.45-.373 2.948-1.075 4.162-2.072 1.557-1.279 2.588-2.983 2.588-5.068 0-.36-.004-1.043-.082-1.896l-.929 1.117a1.126 1.126 0 0 1-1.728-1.442l2.5-3 .109-.113a1.125 1.125 0 0 1 1.847.562c.535 2.141.533 4.091.533 4.772 0 2.915-1.469 5.211-3.412 6.807-1.927 1.583-4.38 2.536-6.574 2.81a1.1 1.1 0 0 1-.278 0c-2.193-.274-4.647-1.227-6.574-2.81-1.943-1.596-3.412-3.892-3.412-6.807 0-.68-.002-2.63.533-4.772l.049-.15a1.126 1.126 0 0 1 1.907-.299l2.5 3 .07.093a1.125 1.125 0 0 1-1.72 1.432l-.078-.083-.93-1.117a20 20 0 0 0-.081 1.896c0 2.085 1.031 3.79 2.588 5.068 1.214.997 2.712 1.699 4.162 2.072z"
      />
      <path
        fill={color}
        d="M12.875 4a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0m2.25 0c0 1.328-.83 2.46-2 2.912v.963H14.5l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.006h-5a1.125 1.125 0 0 1 0-2.25h1.376v-.963A3.124 3.124 0 1 1 15.125 4"
      />
    </svg>
  );
}
