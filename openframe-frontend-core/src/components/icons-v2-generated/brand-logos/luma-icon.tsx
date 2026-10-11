import type { SVGProps } from "react";
export interface LumaIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function LumaIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: LumaIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 133 134"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M133 67C96.282 67 66.5 36.994 66.5 0c0 36.994-29.782 67-66.5 67 36.718 0 66.5 30.006 66.5 67 0-36.994 29.782-67 66.5-67" />
        </svg>
    );
}
