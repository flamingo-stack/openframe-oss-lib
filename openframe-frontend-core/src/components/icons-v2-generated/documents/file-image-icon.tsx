import type { SVGProps } from "react";
export interface FileImageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileImageIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FileImageIconProps) {
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
        d="M13.586.875c.293 0 .58.063.844.177l.022.009q.258.115.48.296l.157.14 5.414 5.415c.18.18.322.39.426.618q.012.022.022.047c.113.262.174.547.174.838V19c0 .205-.022.406-.05.603q-.006.053-.017.107A4.12 4.12 0 0 1 17 23.125H7a4.12 4.12 0 0 1-4.06-3.414q-.01-.06-.017-.124A4 4 0 0 1 2.875 19V5A4.125 4.125 0 0 1 7 .875zm-2.584 17.213a2.125 2.125 0 0 1-2.843.147l-.161-.147-.498-.498-2.2 2.2c.299.64.947 1.085 1.7 1.085h10c.753 0 1.4-.445 1.698-1.086L14 15.09l-2.997 3ZM15.125 6c0 .484.392.875.875.875h1.285l-2.16-2.16zm-10 10.783.873-.871.161-.147a2.13 2.13 0 0 1 2.682 0l.161.147.497.496 2.999-2.997.16-.145a2.125 2.125 0 0 1 2.683 0l.161.145 3.373 3.374v-7.66H16A3.125 3.125 0 0 1 12.876 6V3.125H7c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="M9.217 8.885a2.126 2.126 0 1 1-2.332 2.332l-.01-.216.01-.219A2.126 2.126 0 0 1 9 8.875z"
      />
    </svg>
  );
}
