import type { SVGProps } from "react";
export interface GoogleSheetsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
}
export function GoogleSheetsIcon({
  className = "",
  size = 24,
  ...props
}: GoogleSheetsIconProps) {
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
        fill="#0F9D58"
        d="M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6.727z"
      />
      <path
        fill="#F1F1F1"
        d="M9.273 16.909h-2.91v-1.636h2.91v1.636zm0-2.727h-2.91V12.545h2.91v1.637zm0-2.727h-2.91V9.818h2.91v1.637zm8.363 5.454h-2.909v-1.636h2.91v1.636zm0-2.727h-2.909V12.545h2.91v1.637zm0-2.727h-2.909V9.818h2.91v1.637zm-4.909 5.454h-2.182v-1.636h2.182v1.636zm0-2.727h-2.182V12.545h2.182v1.637zm0-2.727h-2.182V9.818h2.182v1.637z"
      />
      <path fill="#87CEAC" d="M14.727 0v6.727h6.727" />
    </svg>
  );
}
