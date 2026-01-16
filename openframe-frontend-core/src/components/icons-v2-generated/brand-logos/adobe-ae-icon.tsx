import type { SVGProps } from "react";
export interface AdobeAeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AdobeAeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AdobeAeIconProps) {
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
        d="M6.975 8.14c.558-1.687 2.99-1.687 3.55 0l.05.175 1.769 7.424.022.113a1.125 1.125 0 0 1-2.178.52l-.033-.112-.39-1.635h-2.03l-.39 1.635a1.125 1.125 0 0 1-2.188-.521l1.77-7.424.05-.174Zm1.296 4.236h.958l-.48-2.009zm7.478-1.252a.87.87 0 0 0-.86.75h1.723a.87.87 0 0 0-.862-.75Zm3.126 1.376c0 .898-.728 1.624-1.625 1.624h-2.363c.06.424.422.75.862.75.372 0 .655-.146.795-.295a1.124 1.124 0 0 1 1.645 1.535c-.61.653-1.513 1.01-2.44 1.01A3.125 3.125 0 0 1 12.625 14v-2a3.126 3.126 0 1 1 6.25 0z"
      />
    </svg>
  );
}
