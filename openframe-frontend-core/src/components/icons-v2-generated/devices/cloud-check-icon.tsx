import type { SVGProps } from "react";
export interface CloudCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CloudCheckIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CloudCheckIconProps) {
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
        d="M2.78 11.06c0-4.533 3.715-8.185 8.268-8.185 4.126 0 7.56 2.997 8.17 6.932 2.27.804 3.906 2.947 3.907 5.487 0 3.232-2.648 5.831-5.886 5.831H6.286c-2.976 0-5.411-2.388-5.411-5.36 0-1.65.752-3.12 1.926-4.1a8 8 0 0 1-.022-.606Zm2.25 0q0 .482.075.944c.073.446-.129.893-.512 1.134a3.1 3.1 0 0 0-1.468 2.626c0 1.705 1.403 3.111 3.161 3.111H17.24c2.02 0 3.636-1.616 3.636-3.581 0-1.724-1.243-3.178-2.914-3.51-.504-.1-.876-.53-.904-1.044-.167-3.117-2.782-5.615-6.009-5.615-3.336 0-6.019 2.67-6.019 5.934Z"
      />
      <path
        fill={color}
        d="M13.204 9.705a1.125 1.125 0 0 1 1.59 1.59l-4.5 4.5c-.438.44-1.15.44-1.59 0l-2-2-.077-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L9.5 13.41z"
      />
    </svg>
  );
}
