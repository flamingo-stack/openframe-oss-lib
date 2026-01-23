import type { SVGProps } from "react";
export interface MovieIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MovieIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MovieIconProps) {
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
        d="m21 20.875.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005h-9a1.125 1.125 0 0 1 0-2.25zm-8.783-5.99a2.126 2.126 0 1 1-2.33 2.333L9.874 17l.011-.217A2.125 2.125 0 0 1 12 14.875zm-5-4.999A2.125 2.125 0 1 1 7 9.875zm10 0a2.125 2.125 0 1 1-2.331 2.33l-.01-.216.01-.217A2.126 2.126 0 0 1 17 9.875l.218.011ZM12 4.875a2.126 2.126 0 1 1-2.114 2.342L9.875 7l.011-.218A2.125 2.125 0 0 1 12 4.875"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
