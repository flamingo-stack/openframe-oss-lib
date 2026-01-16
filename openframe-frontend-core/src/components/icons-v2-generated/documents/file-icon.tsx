import type { SVGProps } from "react";
export interface FileIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FileIconProps) {
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
        d="M12.875 6V2.09a1.125 1.125 0 0 1 2.25 0V6c0 .483.392.875.874.875h3.912l.114.006a1.125 1.125 0 0 1 0 2.239l-.114.005h-3.912A3.126 3.126 0 0 1 12.875 6"
      />
      <path
        fill={color}
        d="M21.125 19A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.493 0 .968.172 1.346.482l.157.14 5.414 5.415c.398.398.622.939.622 1.503zm-16 0c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875V8.466l-5.34-5.341H7c-1.036 0-1.875.84-1.875 1.875z"
      />
    </svg>
  );
}
