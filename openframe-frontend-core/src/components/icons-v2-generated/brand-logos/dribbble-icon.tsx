import type { SVGProps } from "react";
export interface DribbbleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DribbbleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DribbbleIconProps) {
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
        d="M13.875 19c0-1.146-.103-2.269-.299-3.359a18.9 18.9 0 0 0-6.846 5.004 1.125 1.125 0 1 1-1.701-1.473 21.2 21.2 0 0 1 8.008-5.744 19 19 0 0 0-.98-2.514A21.1 21.1 0 0 1 5 12.126q-1.18-.001-2.33-.128l-.76-.098-.114-.022a1.125 1.125 0 0 1 .325-2.215l.114.012.682.086a18.86 18.86 0 0 0 8.04-.848 19 19 0 0 0-3.978-4.5l-.412-.33-.088-.076A1.125 1.125 0 0 1 7.852 2.24l.095.066.461.37a21.2 21.2 0 0 1 4.667 5.389 19 19 0 0 0 5.337-3.783 1.126 1.126 0 1 1 1.6 1.582 21.2 21.2 0 0 1-5.872 4.187q.598 1.278 1.024 2.643A21.1 21.1 0 0 1 22 11.899a1.126 1.126 0 0 1-.104 2.247 18.9 18.9 0 0 0-6.177.728 21.2 21.2 0 0 1 .23 6.864l-.02.113a1.126 1.126 0 0 1-2.21-.403l.067-.604q.089-.91.089-1.844"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
