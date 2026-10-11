import type { SVGProps } from "react";
export interface HamburgerIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function HamburgerIcon({
    className = "",
    size = 24,
    color = '#FAFAFA',
    ...props
}: HamburgerIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 16 16"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M14 11.25a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1 0-1.5zM14 7.25a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1 0-1.5zm0-4a.75.75 0 0 1 0 1.5H2a.75.75 0 0 1 0-1.5z"
            />
        </svg>
    );
}
