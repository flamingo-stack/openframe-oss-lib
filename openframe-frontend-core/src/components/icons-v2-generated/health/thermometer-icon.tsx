import type { SVGProps } from "react";
export interface ThermometerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ThermometerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ThermometerIconProps) {
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
        d="M3.205 16.705a1.125 1.125 0 0 1 1.505-.078l.085.078 2.5 2.499a1.127 1.127 0 0 1-1.59 1.592l-2.5-2.5-.078-.085a1.126 1.126 0 0 1 .078-1.506M15.29 7.128a1.125 1.125 0 0 1 1.505 1.668l-3.5 3.5a1.125 1.125 0 0 1-1.59-1.591l3.5-3.501zM19.876 5.5a1.375 1.375 0 0 1-2.744.141l-.007-.14.007-.141A1.375 1.375 0 0 1 18.5 4.125l.141.007c.693.07 1.235.657 1.235 1.368"
      />
      <path
        fill={color}
        d="M15.34 2.076a4.66 4.66 0 0 1 6.418.166l.166.174a4.66 4.66 0 0 1-.166 6.416l-6.363 6.364a7.1 7.1 0 0 1-2.65 1.675l-.43.138-1.508.43a.9.9 0 0 0-.294.15l-.084.073-4.614 4.613a2.893 2.893 0 0 1-4.091-4.09l4.614-4.614.073-.083a.9.9 0 0 0 .15-.295l.43-1.507a7.1 7.1 0 0 1 1.812-3.08l6.365-6.364zm4.828 1.757a2.41 2.41 0 0 0-3.41 0l-6.362 6.363a4.9 4.9 0 0 0-1.241 2.108l-.43 1.507a3.1 3.1 0 0 1-.66 1.206l-.136.145-4.613 4.614h-.002a.642.642 0 0 0 .91.908l4.614-4.613.145-.136a3.1 3.1 0 0 1 1.206-.659l1.507-.43a4.9 4.9 0 0 0 2.108-1.241l6.364-6.364a2.41 2.41 0 0 0 .165-3.225z"
      />
    </svg>
  );
}
