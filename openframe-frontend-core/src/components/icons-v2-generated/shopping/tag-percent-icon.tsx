import type { SVGProps } from "react";
export interface TagPercentIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TagPercentIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TagPercentIconProps) {
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
        d="M20.877 4.22c0-.606-.491-1.097-1.097-1.097h-6.4a2.2 2.2 0 0 0-1.4.5l-.163.147-8.043 8.044a2.21 2.21 0 0 0 0 3.124l5.286 5.288.169.151a2.21 2.21 0 0 0 2.956-.15l8.045-8.046a2.2 2.2 0 0 0 .646-1.561v-6.4Zm2.25 6.4c0 1.182-.47 2.316-1.305 3.152l-8.045 8.045a4.46 4.46 0 0 1-6.14.158l-.166-.158-5.287-5.288a4.46 4.46 0 0 1 0-6.306l8.043-8.044.329-.297A4.46 4.46 0 0 1 13.38.872h6.399a3.347 3.347 0 0 1 3.347 3.348z"
      />
      <path
        fill={color}
        d="m14.75 11.876.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006h-7.5a1.125 1.125 0 0 1 0-2.25zM12.376 16.5a1.376 1.376 0 0 1-2.744.14l-.007-.14.007-.14A1.376 1.376 0 0 1 11 15.123l.14.008c.694.07 1.236.656 1.236 1.368Zm0-7a1.376 1.376 0 0 1-2.744.14l-.007-.14.007-.141A1.375 1.375 0 0 1 11 8.125l.14.006c.694.07 1.235.657 1.236 1.368Zm6-2.5a1.375 1.375 0 0 1-2.744.141l-.007-.14.007-.141A1.375 1.375 0 0 1 17 5.625l.14.007c.694.07 1.236.657 1.236 1.368"
      />
    </svg>
  );
}
