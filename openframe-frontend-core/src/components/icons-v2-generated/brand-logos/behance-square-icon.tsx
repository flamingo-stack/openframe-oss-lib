import type { SVGProps } from "react";
export interface BehanceSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BehanceSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BehanceSquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M9.626 14a.875.875 0 0 0-.874-.874H7.375v1.748h1.377A.875.875 0 0 0 9.626 14m6.123-4.625a3.125 3.125 0 0 1 3.126 3.125v.5c0 .62-.503 1.124-1.125 1.124h-2.863c.06.424.422.75.862.75.372 0 .655-.146.795-.295a1.124 1.124 0 0 1 1.645 1.535c-.61.653-1.513 1.01-2.44 1.01A3.125 3.125 0 0 1 12.625 14v-1.5a3.125 3.125 0 0 1 3.124-3.125m0 2.25a.87.87 0 0 0-.609.25h1.22a.87.87 0 0 0-.61-.25Zm.75-4.75.116.006a1.125 1.125 0 0 1 0 2.238l-.115.006H15a1.125 1.125 0 0 1 0-2.25h1.5ZM9.627 10a.875.875 0 0 0-.874-.875H7.375v1.75h1.377l.176-.017A.876.876 0 0 0 9.626 10Zm2.25 0c0 .76-.273 1.457-.725 1.999a3.125 3.125 0 0 1-2.4 5.126h-1.93c-.937 0-1.696-.76-1.696-1.697V8.571c0-.937.76-1.696 1.696-1.696h1.931A3.125 3.125 0 0 1 11.876 10Z"
      />
    </svg>
  );
}
