import type { SVGProps } from "react";
export interface UserSearchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserSearchIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: UserSearchIconProps) {
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
        d="M19.875 18a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0c0 .73-.193 1.413-.526 2.008l1.197 1.197.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-1.197-1.197a4.1 4.1 0 0 1-2.008.526A4.125 4.125 0 1 1 22.125 18m-10.45-4.125.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H7.143a4.014 4.014 0 0 0-4.005 3.75h8.534l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm1.45-6.625a3.126 3.126 0 1 0-6.251.002 3.126 3.126 0 0 0 6.252-.002Zm2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
