import type { SVGProps } from "react";
export interface ReflectHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ReflectHrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ReflectHrIconProps) {
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
        d="M10.658 14.766a2.13 2.13 0 0 1 2.684 0l.161.146 4.439 4.439c1.023 1.023.299 2.774-1.149 2.774H7.207c-1.448 0-2.172-1.75-1.148-2.774l4.438-4.439zm-1.942 5.109h6.568L12 16.591zm8.077-18c1.448 0 2.172 1.75 1.149 2.774l-4.439 4.439c-.83.83-2.176.83-3.006 0L6.06 4.649c-1.024-1.023-.3-2.774 1.148-2.774h9.586ZM12 7.409l3.284-3.284H8.716zm9 3.466a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
