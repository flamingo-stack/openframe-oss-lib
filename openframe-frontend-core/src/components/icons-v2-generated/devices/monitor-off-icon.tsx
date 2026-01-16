import type { SVGProps } from "react";
export interface MonitorOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MonitorOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MonitorOffIconProps) {
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
        d="M20.876 14V6c0-1.035-.84-1.875-1.875-1.875H8.674a1.125 1.125 0 0 1 0-2.25H19A4.126 4.126 0 0 1 23.126 6v8c0 .891-.285 1.72-.768 2.396l-.072.09a1.126 1.126 0 0 1-1.759-1.398l.146-.242c.13-.254.203-.54.203-.846M1.205 1.205a1.125 1.125 0 0 1 1.506-.078l.085.078 19 19 .076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-3.67-3.67h-3.41v1.75H16l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.005H8a1.125 1.125 0 0 1 0-2.25h2.876v-1.75H5A4.125 4.125 0 0 1 .875 14V6c0-.989.35-1.895.93-2.605l-.6-.6-.078-.084a1.125 1.125 0 0 1 .078-1.506M3.125 14c0 1.036.84 1.875 1.875 1.875h9.284L3.414 5.005c-.182.289-.289.63-.289.996z"
      />
    </svg>
  );
}
