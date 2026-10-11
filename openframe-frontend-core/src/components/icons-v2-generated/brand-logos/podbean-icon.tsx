import type { SVGProps } from "react";
export interface PodbeanIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function PodbeanIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: PodbeanIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill="none"
                stroke={color}
                strokeLinecap="round"
                strokeWidth={2.5}
                d="M3 10a12 12 0 0 1 18 0M7 14a7 7 0 0 1 10 0"
            />
            <circle cx={12} cy={19} r={2.5} />
        </svg>
    );
}
