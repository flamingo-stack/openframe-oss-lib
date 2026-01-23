import type { SVGProps } from "react";
export interface CodeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CodeIconProps) {
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
        d="M12.933 2.646a1.125 1.125 0 0 1 2.165.599l-4 18a1.126 1.126 0 0 1-2.197-.49l4-18zM6.204 6.205a1.125 1.125 0 0 1 1.591 1.59L3.589 12l4.206 4.205.078.085a1.125 1.125 0 0 1-1.582 1.582l-.087-.076-5-5.001a1.125 1.125 0 0 1 0-1.59zm10 0a1.126 1.126 0 0 1 1.506-.078l.085.078 5 5c.44.438.44 1.15 0 1.59l-5 5a1.125 1.125 0 0 1-1.59-1.59L20.409 12l-4.204-4.205-.078-.085a1.125 1.125 0 0 1 .078-1.505Z"
      />
    </svg>
  );
}
