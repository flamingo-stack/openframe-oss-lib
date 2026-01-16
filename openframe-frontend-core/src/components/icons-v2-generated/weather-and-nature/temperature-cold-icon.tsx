import type { SVGProps } from "react";
export interface TemperatureColdIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TemperatureColdIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TemperatureColdIconProps) {
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
        d="M8.375 4.5a1.375 1.375 0 1 0-2.75 0v9.897c0 .582-.238 1.076-.543 1.441l-.135.148a2.875 2.875 0 1 0 4.288.204l-.182-.204c-.367-.373-.678-.924-.678-1.589zm2.25 9.868.005.01.028.034.167.177a5.124 5.124 0 1 1-7.484-.177l.028-.034.006-.01V4.5a3.626 3.626 0 0 1 7.25 0zM14.374 18v-1.277a1.1 1.1 0 0 1-.625-.41 1.125 1.125 0 0 1 .226-1.575l.4.534v-.002l-.4-.532.4-.3v-1.814H13.5a1.125 1.125 0 0 1 0-2.25h.874V8.561l-1.55-1.162-.087-.073a1.125 1.125 0 0 1 1.343-1.79l.095.065.2.149V5a1.125 1.125 0 0 1 2.25 0v.75l.2-.15.095-.064A1.125 1.125 0 0 1 18.174 7.4l-1.55 1.162v1.813h1.814l1.162-1.55.074-.087a1.124 1.124 0 0 1 1.726 1.438l-.15.2H22l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.005h-.752l.15.201.065.095a1.125 1.125 0 0 1-1.79 1.344l-.074-.09-1.164-1.55h-1.811v1.813l1.55 1.163.089.074a1.124 1.124 0 0 1-1.344 1.79l-.095-.064-.2-.151v.752a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
