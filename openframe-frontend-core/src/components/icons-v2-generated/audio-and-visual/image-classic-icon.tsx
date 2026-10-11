import type { SVGProps } from "react";
export interface ImageClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function ImageClassicIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: ImageClassicIconProps) {
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
            <rect
                width={18}
                height={18}
                x={3}
                y={3}
                stroke={color}
                strokeWidth={2}
                rx={2}
            />
            <circle cx={8.5} cy={8.5} r={1.5} fill={color} />
            <path
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m21 15-5-5L5 21"
            />
        </svg>
    );
}
