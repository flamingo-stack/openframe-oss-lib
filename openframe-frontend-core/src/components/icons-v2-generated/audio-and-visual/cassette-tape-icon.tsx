import type { SVGProps } from "react";
export interface CassetteTapeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CassetteTapeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CassetteTapeIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875h-.434l-1.008 2.184a3.13 3.13 0 0 1-2.837 1.816H9.28a3.13 3.13 0 0 1-2.736-1.612l-.102-.204-1.01-2.184H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm-12.39-.633c.143.31.454.508.795.508h5.44a.87.87 0 0 0 .795-.508l.572-1.242H7.912zM23.125 17A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M8.875 14a.876.876 0 1 0-1.751.002A.876.876 0 0 0 8.875 14m2.25 0c0 .304-.046.598-.127.876h2.004a3.1 3.1 0 0 1-.128-.877c0-.303.047-.596.128-.874h-2.004c.081.278.127.57.128.874Zm4 0a.876.876 0 1 0 1.75 0 .876.876 0 0 0-1.75 0m4 0A3.126 3.126 0 0 1 16 17.124H8a3.126 3.126 0 0 1-.32-6.234l.32-.016h8a3.125 3.125 0 0 1 3.125 3.124Z"
      />
    </svg>
  );
}
