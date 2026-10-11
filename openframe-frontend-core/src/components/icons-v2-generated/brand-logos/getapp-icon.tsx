import type { SVGProps } from "react";
export interface GetappIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function GetappIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: GetappIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="10 260 170 90"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill="#009C9C"
                d="m171 307.9-40.5-40.5c-1.4-1.3-3.5-1.3-4.8 0l-8 8 32.5 32.5c1.3 1.3 1.3 3.5 0 4.8l-33.5 33.5 8 8c1.4 1.3 3.5 1.3 4.8 0l41.4-41.4c1.4-1.4 1.4-3.5.1-4.9"
            />
            <path
                fill="#40E3E3"
                d="m102 270.4-2.9-2.9c-1.4-1.3-3.5-1.3-4.8 0l-8 8 5.3 5.3 10.4 10.4 10.4-10.4zM101.1 330.6 90.7 341l-5.3 5.3 8 8c1.4 1.3 3.5 1.3 4.8 0l2.9-2.9 10.4-10.4z"
            />
            <path
                fill="#1ABAB8"
                d="M118.9 307.9c1.3 1.4 1.3 3.5 0 4.8l-17.8 17.8 10.4 10.4 28.2-28.2c1.3-1.3 1.3-3.5 0-4.8l-27.2-27.2-10.5 10.4z"
            />
            <path
                fill="#87F0F0"
                d="M52.8 308.9 81 280.7l-10.4-10.4-3-2.9c-1.4-1.3-3.5-1.3-4.8 0l-41.4 41.5c-1.3 1.3-1.3 3.5 0 4.8l40.5 40.5c1.4 1.3 3.5 1.3 4.8 0l3-2.9 10.4-10.4-27.2-27.2c-1.4-1.3-1.4-3.4-.1-4.8"
            />
            <path
                fill="#17CFCF"
                d="m84.2 308.9 12.4-12.4-10.4-10.4-5.3-5.3-28 28.2c-1.3 1.3-1.3 3.5 0 4.8L80 340.9l5.3-5.3 10.4-10.4-11.5-11.5c-1.3-1.2-1.3-3.4 0-4.8"
            />
            <path
                fill="#424A52"
                d="m84.2 313.7 11.5 11.5 12.4-12.4c1.3-1.3 1.3-3.5 0-4.8l-11.5-11.5-12.4 12.4c-1.2 1.4-1.2 3.5 0 4.8"
            />
        </svg>
    );
}
