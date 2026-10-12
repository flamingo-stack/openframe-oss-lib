import type { SVGProps } from "react";
export interface VendorDirectoryIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VendorDirectoryIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: VendorDirectoryIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M15.73 9.717V7.009l-5.626 3.125v6.333a.934.934 0 0 1 .103 1.81 3.44 3.44 0 0 1-2.494-.16l-.195-.1-5-2.733a3.44 3.44 0 0 1-1.789-3.016V6.899c0-.587.152-1.15.424-1.648a1 1 0 0 1 .141-.238c.305-.463.72-.855 1.224-1.13l5-2.733.195-.099a3.44 3.44 0 0 1 3.103.099l5 2.733.201.12c.416.265.763.615 1.026 1.018a1 1 0 0 1 .138.23c.271.497.423 1.061.423 1.648v2.818a.937.937 0 1 1-1.875 0M9.915 2.795a1.56 1.56 0 0 0-1.32-.084l-.179.084-4.81 2.629 5.56 3.087 5.558-3.087zm-7.312 9.473c0 .571.312 1.097.813 1.37l4.812 2.63v-6.134L2.604 7.01z"
      />
      <path
        fill={color}
        d="M16.98 15.416a1.562 1.562 0 1 0-3.126 0 1.562 1.562 0 0 0 3.125 0m1.874 0c0 .608-.16 1.178-.438 1.674l.58.58.065.072a.937.937 0 0 1-1.319 1.318l-.072-.065-.58-.58a3.4 3.4 0 0 1-1.673.439 3.438 3.438 0 1 1 3.437-3.438"
      />
    </svg>
  );
}
