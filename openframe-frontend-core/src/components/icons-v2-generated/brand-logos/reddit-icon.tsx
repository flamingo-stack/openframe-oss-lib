import type { SVGProps } from "react";
export interface RedditIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function RedditIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: RedditIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M248 104a31.992 31.992 0 0 0-52.937-24.19c-16.755-8.902-36.762-14.28-57.666-15.526l5.195-31.176 21.831 3.359a24.004 24.004 0 1 0 2.435-15.814l-29.642-4.56a7.996 7.996 0 0 0-9.107 6.592l-6.913 41.478c-21.839.941-42.813 6.378-60.258 15.647a31.993 31.993 0 0 0-42.593 47.74A59 59 0 0 0 16 144c0 21.935 12.042 42.352 33.907 57.49C70.875 216.005 98.61 224 128 224s57.125-7.994 78.093-22.51C227.958 186.351 240 165.934 240 144a59 59 0 0 0-2.346-16.45A32.17 32.17 0 0 0 248 104M72 132a16 16 0 1 1 16 16 16.02 16.02 0 0 1-16-16m92.696 51.11a80.12 80.12 0 0 1-73.392 0 8 8 0 0 1 7.34-14.217 64.1 64.1 0 0 0 58.711 0 8 8 0 0 1 7.341 14.216M168 148a16 16 0 1 1 16-16 16.02 16.02 0 0 1-16 16"
            />
        </svg>
    );
}
