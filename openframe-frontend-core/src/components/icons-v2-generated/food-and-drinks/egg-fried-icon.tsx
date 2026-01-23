import type { SVGProps } from "react";
export interface EggFriedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EggFriedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EggFriedIconProps) {
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
        d="M20.875 7.93c0-2.642-2.17-4.805-4.874-4.805-.954 0-1.84.27-2.59.734-1.539.954-3.514 1.506-5.329 1.476l-.083-.001c-2.704 0-4.874 2.165-4.874 4.806 0 1.52.716 2.88 1.843 3.763a8.7 8.7 0 0 1 2.721 3.683c.723 1.907 2.514 3.288 4.538 3.289 2.704 0 4.875-2.163 4.875-4.805 0-1.656.802-3.416 2.073-4.493a4.77 4.77 0 0 0 1.7-3.647m2.25 0c0 2.15-.971 4.073-2.495 5.364-.759.643-1.277 1.771-1.277 2.776 0 3.908-3.203 7.055-7.126 7.055-3.074 0-5.631-2.072-6.643-4.74a6.44 6.44 0 0 0-2.005-2.712A7.02 7.02 0 0 1 .875 10.14c0-3.908 3.202-7.056 7.124-7.056l.12.001c1.379.023 2.93-.41 4.107-1.14l.42-.24a7.15 7.15 0 0 1 3.355-.83c3.922 0 7.123 3.146 7.123 7.055Z"
      />
      <path
        fill={color}
        d="M12.555 11.02a2.125 2.125 0 1 0-4.25-.001 2.125 2.125 0 0 0 4.25 0Zm2.25 0a4.374 4.374 0 1 1-8.748 0 4.374 4.374 0 0 1 8.748 0"
      />
    </svg>
  );
}
