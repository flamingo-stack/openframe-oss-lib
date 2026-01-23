import type { SVGProps } from "react";
export interface UsersPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UsersPlusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UsersPlusIconProps) {
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
        d="M17.875 21v-1.874H16a1.126 1.126 0 0 1 0-2.25h1.875V15a1.125 1.125 0 0 1 2.25 0v1.875H22l.116.004a1.127 1.127 0 0 1 0 2.24l-.116.006h-1.875V21a1.126 1.126 0 0 1-2.25 0m.249-12.25c0-1.16-.754-2.149-1.802-2.494l.353-1.068.352-1.068a4.876 4.876 0 0 1-.725 9.44 1.125 1.125 0 1 1-.37-2.22 2.63 2.63 0 0 0 2.192-2.59m-2.518-3.914c.194-.59.83-.91 1.42-.716l-.704 2.136c-.59-.195-.91-.83-.716-1.42m-4.75 9.039a6.3 6.3 0 0 1 2.229.407l.292.12.104.053a1.124 1.124 0 0 1-.9 2.048l-.488-.185a4 4 0 0 0-1.237-.193H7.143a4.014 4.014 0 0 0-4.005 3.75h10.213l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm1.269-6.625a3.125 3.125 0 1 0-6.25 0 3.125 3.125 0 0 0 6.25 0m2.25 0a5.376 5.376 0 1 1-10.752 0 5.376 5.376 0 0 1 10.752 0"
      />
    </svg>
  );
}
