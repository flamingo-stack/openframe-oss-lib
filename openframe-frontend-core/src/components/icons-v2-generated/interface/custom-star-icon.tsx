import type { SVGProps } from "react";
export interface CustomStarIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function CustomStarIcon({
    className = "",
    size = 24,
    color = '#888888',
    ...props
}: CustomStarIconProps) {
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
            <path
                fill={color}
                d="M9.747 2.147c1.042-1.758 3.664-1.7 4.601.176l2.026 4.055 4.497.646c2.096.3 2.967 2.81 1.588 4.344l-.14.145-3.235 3.113.767 4.418c.372 2.14-1.867 3.78-3.795 2.779L12 19.715l-4.056 2.108c-1.928 1.001-4.168-.639-3.797-2.779l.766-4.418-3.233-3.113C.106 9.998.965 7.335 3.127 7.023l4.497-.645 2.028-4.055zm2.588 1.182a.375.375 0 0 0-.67 0L9.608 7.442a2.13 2.13 0 0 1-1.6 1.153l-4.56.657a.374.374 0 0 0-.207.64l3.28 3.16.178.194c.383.473.548 1.093.442 1.7l-.777 4.483a.375.375 0 0 0 .542.397l4.113-2.137.236-.104c.48-.18 1.008-.18 1.488 0l.234.104 4.115 2.137a.375.375 0 0 0 .542-.397l-.778-4.482a2.13 2.13 0 0 1 .62-1.894l3.281-3.161a.374.374 0 0 0-.206-.64l-4.563-.657c-.69-.099-1.287-.53-1.599-1.153z"
            />
        </svg>
    );
}
