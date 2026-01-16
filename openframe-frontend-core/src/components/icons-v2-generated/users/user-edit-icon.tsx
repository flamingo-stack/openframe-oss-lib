import type { SVGProps } from "react";
export interface UserEditIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserEditIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: UserEditIconProps) {
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
        d="M18.089 12.645a2.625 2.625 0 0 1 3.712 0l.554.554.18.2a2.625 2.625 0 0 1 0 3.313l-.18.199-1.336 1.334-.01.014-.014.01-3.39 3.391a4.13 4.13 0 0 1-2.238 1.153l-1.778.296a1.475 1.475 0 0 1-1.698-1.698l.296-1.778a4.13 4.13 0 0 1 1.153-2.239zm-3.158 6.34c-.277.277-.46.633-.525 1.018l-.118.708.709-.117a1.88 1.88 0 0 0 1.018-.525l2.606-2.607-1.084-1.084zm5.279-4.749a.375.375 0 0 0-.53 0l-.551.551 1.084 1.084.55-.55a.375.375 0 0 0 .05-.473l-.05-.058zm-8.538-.361.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H7.143a4.014 4.014 0 0 0-4.005 3.75h5.92l.115.006a1.124 1.124 0 0 1 0 2.238l-.115.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm1.454-6.625a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
