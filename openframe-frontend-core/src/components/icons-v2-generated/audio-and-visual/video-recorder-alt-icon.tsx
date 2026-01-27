import type { SVGProps } from "react";
export interface VideoRecorderAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VideoRecorderAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VideoRecorderAltIconProps) {
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
        d="M23.125 19.039c0 1.232-1.3 1.987-2.35 1.456l-.207-.124-4.213-2.95-.09-.07a1.126 1.126 0 0 1 1.283-1.833l.097.061 3.23 2.259V12.16l-3.23 2.262a1.125 1.125 0 0 1-1.29-1.843l4.213-2.95.207-.123c1.05-.532 2.35.222 2.35 1.454z"
      />
      <path
        fill={color}
        d="M15.875 12c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v6c0 1.035.84 1.875 1.875 1.875h9c1.036 0 1.875-.84 1.875-1.875zm-2-6a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m-8.75.5a1.376 1.376 0 1 0 2.751-.001 1.376 1.376 0 0 0-2.751 0Zm11-.5a4.1 4.1 0 0 1-.618 2.162A4.12 4.12 0 0 1 18.125 12v6A4.125 4.125 0 0 1 14 22.125H5A4.125 4.125 0 0 1 .875 18v-6a4.12 4.12 0 0 1 2.442-3.765A3.625 3.625 0 0 1 6.5 2.875c.809 0 1.553.268 2.156.715a4.12 4.12 0 0 1 3.345-1.715A4.125 4.125 0 0 1 16.125 6"
      />
    </svg>
  );
}
