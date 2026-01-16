import type { SVGProps } from "react";
export interface UsersIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UsersIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: UsersIconProps) {
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
        d="M18.124 7.75c0-1.16-.754-2.149-1.802-2.494l.353-1.068.352-1.068a4.876 4.876 0 0 1-.725 9.44 1.125 1.125 0 1 1-.37-2.22 2.63 2.63 0 0 0 2.192-2.59m-2.518-3.914c.194-.59.83-.91 1.42-.716l-.704 2.136c-.59-.195-.91-.83-.716-1.42m7.519 15.45a1.84 1.84 0 0 1-1.84 1.838H20a1.125 1.125 0 0 1 0-2.25h.846a3.16 3.16 0 0 0-2.577-2.7 1.125 1.125 0 0 1 .391-2.216 5.41 5.41 0 0 1 4.465 5.328M7.143 16.125a4.014 4.014 0 0 0-4.005 3.75h11.723a4.015 4.015 0 0 0-4.005-3.75zm4.982-8.875a3.125 3.125 0 1 0-6.25 0 3.125 3.125 0 0 0 6.25 0m5 12.893a1.98 1.98 0 0 1-1.982 1.982H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268h3.713a6.27 6.27 0 0 1 6.269 6.268M14.375 7.25a5.376 5.376 0 1 1-10.752 0 5.376 5.376 0 0 1 10.752 0"
      />
    </svg>
  );
}
