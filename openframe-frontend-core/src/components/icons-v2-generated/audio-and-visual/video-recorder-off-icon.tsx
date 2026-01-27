import type { SVGProps } from "react";
export interface VideoRecorderOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VideoRecorderOffIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VideoRecorderOffIconProps) {
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
        d="M14.875 11.332V8c0-1.035-.84-1.875-1.875-1.875H9.668a1.125 1.125 0 0 1 0-2.25H13A4.12 4.12 0 0 1 17.12 7.9l3.479-2.318.206-.118c1.049-.503 2.32.253 2.32 1.47v10.132a1.126 1.126 0 0 1-2.25 0V8.1l-3.75 2.5v.731a1.126 1.126 0 0 1-2.25 0ZM1.205 2.205a1.125 1.125 0 0 1 1.505-.078l.085.078 18 18 .078.085a1.126 1.126 0 0 1-1.584 1.583l-.085-.078-3.093-3.093a4.11 4.11 0 0 1-3.112 1.423H5A4.125 4.125 0 0 1 .876 16V8c0-1.244.551-2.358 1.42-3.113l-1.09-1.092-.078-.085a1.125 1.125 0 0 1 .078-1.505ZM3.125 16c0 1.036.84 1.875 1.875 1.875h8c.62 0 1.173-.303 1.514-.77l-6.98-6.98H6A1.125 1.125 0 0 1 4.875 9c0-.416.227-.777.563-.971L3.894 6.485a1.87 1.87 0 0 0-.77 1.514z"
      />
    </svg>
  );
}
