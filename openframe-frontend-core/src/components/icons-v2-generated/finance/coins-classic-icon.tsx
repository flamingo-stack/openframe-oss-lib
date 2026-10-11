import type { SVGProps } from "react";
export interface CoinsClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function CoinsClassicIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: CoinsClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 20"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <circle cx={7} cy={8} r={4} stroke={color} strokeWidth={1.5} />
            <circle cx={13} cy={12} r={4} stroke={color} strokeWidth={1.5} />
            <path
                stroke={color}
                strokeWidth={1.5}
                d="M9 6c0-1.1.9-2 2-2s2 .9 2 2M15 10c0-1.1.9-2 2-2s2 .9 2 2"
            />
        </svg>
    );
}
