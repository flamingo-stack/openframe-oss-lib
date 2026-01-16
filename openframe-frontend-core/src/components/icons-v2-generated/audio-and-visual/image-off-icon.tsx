import type { SVGProps } from "react";
export interface ImageOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ImageOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ImageOffIconProps) {
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
        d="M19.875 15.344V6c0-1.035-.84-1.875-1.875-1.875H8.665a1.125 1.125 0 0 1 0-2.25H18A4.125 4.125 0 0 1 22.125 6v9.344a1.126 1.126 0 0 1-2.25 0M2.205 2.205a1.125 1.125 0 0 1 1.505-.078l.085.078 18 18 .078.085a1.126 1.126 0 0 1-1.584 1.583l-.085-.078-.194-.194a4.1 4.1 0 0 1-2.01.524H6A4.125 4.125 0 0 1 1.875 18V6c0-.73.191-1.416.524-2.011l-.194-.194-.078-.085a1.125 1.125 0 0 1 .078-1.505m8.797 13.883c-.83.83-2.174.83-3.004 0L7.5 15.59l-3.2 3.198A1.87 1.87 0 0 0 6 19.875h12c.09 0 .176-.01.262-.022l-5.512-5.512zM9 8.875a.13.13 0 0 0-.088.037l.176.176a.125.125 0 0 0-.04-.204zm-4.875 6.909 1.872-1.872.161-.147a2.13 2.13 0 0 1 2.684 0l.16.147.497.496 1.66-1.658-1.682-1.682a2 2 0 0 1-.477.058c-1.1 0-2.005-.837-2.114-1.91L6.874 9l.012-.217q.014-.133.044-.262L4.145 5.736q-.019.13-.02.264z"
      />
    </svg>
  );
}
