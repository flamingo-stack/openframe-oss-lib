import type { SVGProps } from "react";
export interface WingetLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WingetLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WingetLogoGreyIconProps) {
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
        d="M18.249 2H5.75c-.69 0-1.25.56-1.25 1.25v.277H19.5V3.25c0-.69-.56-1.25-1.25-1.25M19.499 4.516H4.5c-.69 0-1.25.56-1.25 1.25v.247h17.497v-.247c0-.69-.56-1.25-1.25-1.25M20.748 7.003c.69 0 1.25.56 1.25 1.25V20.75c0 .69-.56 1.25-1.25 1.25H3.252c-.69 0-1.25-.56-1.25-1.25V8.253c0-.69.56-1.25 1.25-1.25zm-8.719 2.444c-.69 0-1.25.56-1.25 1.25v4.556l-.99-.991a1.25 1.25 0 0 0-1.768 1.767l4.008 4.01.828-.83 3.18-3.18a1.25 1.25 0 0 0-1.767-1.767l-.992.99v-4.555c0-.69-.559-1.25-1.249-1.25"
      />
    </svg>
  );
}
