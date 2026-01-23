import type { SVGProps } from "react";
export interface UserXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserXmarkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UserXmarkIconProps) {
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
        d="M21.204 15.205a1.125 1.125 0 0 1 1.59 1.59L21.09 18.5l1.705 1.705.078.087a1.124 1.124 0 0 1-1.582 1.582l-.087-.078L19.5 20.09l-1.704 1.705a1.125 1.125 0 1 1-1.59-1.59l1.703-1.706-1.703-1.704-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 1.704 1.703zm-8.347-1.33q.165 0 .33.009a1.125 1.125 0 1 1-.117 2.247 4 4 0 0 0-.213-.006H7.143a4.014 4.014 0 0 0-4.005 3.75H13l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm.269-6.625a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
