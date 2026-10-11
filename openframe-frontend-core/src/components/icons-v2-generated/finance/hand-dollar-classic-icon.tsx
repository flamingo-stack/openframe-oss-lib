import type { SVGProps } from "react";
export interface HandDollarClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HandDollarClassicIcon({
  className = "",
  size = 24,
  color = "var(--ods-flamingo-cyan-base)",
  ...props
}: HandDollarClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke={color}
        d="M12 2.75V2m0 .75c-1.016 0-1.827.683-1.828 1.523v.005c0 .914.812 1.316 1.828 1.519 1.037.207 1.828.812 1.828 1.726 0 .955-.812 1.727-1.828 1.727m0-6.5c1.016 0 1.625.61 1.828 1.219M12 9.25V10m0-.75c-1.016 0-1.625-.61-1.828-1.219M2 13h3.59c.564 0 1.125.08 1.666.236l3.14.907c.36.104.735.157 1.11.157h2.284a1.65 1.65 0 0 1 .608 3.184M2.018 19h1.43a2 2 0 0 1 .955.243l3.605 1.962a6.5 6.5 0 0 0 5.324.4l7.516-2.726a1.75 1.75 0 1 0-1.193-3.29l-5.257 1.895M9.94 17.6h3.85q.268-.001.511-.08m.097-.036-.097.035m.097-.035-.097.035"
      />
    </svg>
  );
}
