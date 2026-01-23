import type { SVGProps } from "react";
export interface AppStoreIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AppStoreIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AppStoreIconProps) {
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
        d="M12.012 5.96a1.125 1.125 0 0 1 1.976 1.08l-3.73 6.836h1.956l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005H9.031L7.988 18.04a1.126 1.126 0 0 1-1.976-1.077l.459-.84a1.123 1.123 0 0 1 .029-2.246h1.195l3.022-5.543-.704-1.294-.05-.104a1.125 1.125 0 0 1 1.964-1.072l.06.098.012.023.013-.023Zm1.16 4.521a1.125 1.125 0 0 1 1.465.35l.062.099 1.605 2.946H17.5l.115.005a1.125 1.125 0 0 1-.085 2.242l.457.839a1.125 1.125 0 1 1-1.974 1.077l-3.29-6.031-.05-.104a1.125 1.125 0 0 1 .5-1.423Z"
      />
    </svg>
  );
}
