import type { SVGProps } from "react";
export interface MessagesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MessagesIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MessagesIconProps) {
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
        d="M16.875 6.543V5A.876.876 0 0 0 16 4.125H4A.875.875 0 0 0 3.126 5v8c0 .483.392.875.875.875h1.5c.62 0 1.125.504 1.125 1.125v1.143a1.122 1.122 0 0 1 .999 1.993l-.723.482c-1.08.72-2.526-.054-2.526-1.352v-1.141H4a3.125 3.125 0 0 1-3.125-3.124V5A3.125 3.125 0 0 1 4 1.875h12A3.126 3.126 0 0 1 19.125 5v1.543a1.126 1.126 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 12.04a.375.375 0 0 0-.375-.375h-8a.375.375 0 0 0-.375.375v5.37c0 .207.168.375.375.375h2.925a2.62 2.62 0 0 1 1.636.573l1.064.846v-.294c0-.621.504-1.125 1.125-1.125h1.25a.375.375 0 0 0 .375-.375zm2.25 5.37a2.625 2.625 0 0 1-2.625 2.625h-.125v.467c0 1.277-1.383 2.022-2.433 1.411l-.205-.14-2.077-1.656a.38.38 0 0 0-.235-.082H12.5a2.625 2.625 0 0 1-2.625-2.625v-5.37A2.625 2.625 0 0 1 12.5 9.415h8a2.625 2.625 0 0 1 2.625 2.625z"
      />
    </svg>
  );
}
