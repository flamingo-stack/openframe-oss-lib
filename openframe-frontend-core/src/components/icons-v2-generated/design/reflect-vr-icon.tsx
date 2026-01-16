import type { SVGProps } from "react";
export interface ReflectVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ReflectVrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ReflectVrIconProps) {
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
        d="M1.875 7.207c0-1.357 1.538-2.08 2.574-1.321l.2.173 4.439 4.438c.83.83.83 2.176 0 3.006l-4.439 4.439c-1.023 1.023-2.774.299-2.774-1.149zm2.25 8.077L7.409 12 4.125 8.716zM16.591 12l3.284 3.284V8.716zm5.534 4.793c0 1.448-1.75 2.172-2.774 1.149l-4.439-4.439a2.126 2.126 0 0 1 0-3.006l4.439-4.438.2-.173c1.036-.758 2.574-.036 2.574 1.321zM10.875 21V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
