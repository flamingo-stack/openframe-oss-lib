import type { SVGProps } from "react";
export interface ErrorIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function ErrorIcon({
    className = "",
    size = 24,
    color = '#FF6B6B',
    ...props
}: ErrorIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <circle cx={12} cy={12} r={10} />
            <path d="m15 9-6 6M9 9l6 6" />
        </svg>
    );
}
