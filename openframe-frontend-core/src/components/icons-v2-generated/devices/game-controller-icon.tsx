import type { SVGProps } from "react";
export interface GameControllerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GameControllerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GameControllerIconProps) {
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
        d="M7.374 14.5v-.876H6.5a1.125 1.125 0 0 1 0-2.25h.874V10.5a1.125 1.125 0 0 1 2.25 0v.874h.876l.115.006a1.126 1.126 0 0 1 0 2.239l-.115.005h-.876v.877a1.125 1.125 0 0 1-2.25 0Zm10.017-1.618a1.375 1.375 0 1 1-.14-.008zM14.75 9.375a1.376 1.376 0 1 1-1.368 1.516l-.008-.14.008-.141a1.375 1.375 0 0 1 1.368-1.235"
      />
      <path
        fill={color}
        d="M15.375 2a1.125 1.125 0 0 1 2.25 0A2.626 2.626 0 0 1 15 4.625h-1a.87.87 0 0 0-.863.75h3.25a6.125 6.125 0 0 1 6.105 5.632l.618 7.662a4.125 4.125 0 0 1-4.112 4.456h-.144a4.13 4.13 0 0 1-3.69-2.28l-.86-1.72h-4.61l-.86 1.72a4.12 4.12 0 0 1-3.688 2.28h-.145A4.125 4.125 0 0 1 .89 18.669l.618-7.662a6.125 6.125 0 0 1 6.105-5.632h3.268a3.12 3.12 0 0 1 3.119-3h1A.375.375 0 0 0 15.375 2M7.613 7.625c-2.02 0-3.7 1.551-3.863 3.564l-.618 7.66a1.875 1.875 0 0 0 1.87 2.026h.144c.71 0 1.359-.401 1.676-1.036l.895-1.789.153-.258a2.13 2.13 0 0 1 1.749-.917h4.763c.704 0 1.356.348 1.75.918l.15.257.895 1.789a1.88 1.88 0 0 0 1.677 1.036h.144a1.875 1.875 0 0 0 1.87-2.026l-.619-7.66a3.875 3.875 0 0 0-3.861-3.564z"
      />
    </svg>
  );
}
