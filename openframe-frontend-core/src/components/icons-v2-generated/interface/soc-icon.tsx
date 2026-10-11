import type { SVGProps } from "react";
export interface SocIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function SocIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: SocIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 19 23"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M15.981 6.312a1.88 1.88 0 0 0-1.03-1.42l-5-2.45a1.88 1.88 0 0 0-1.651 0l-5.001 2.45A1.88 1.88 0 0 0 2.25 6.577v6.013l.01.267c.1 1.331.935 2.674 2.178 3.93 1.302 1.314 2.891 2.37 3.983 3.016.44.26.969.26 1.408 0 1.092-.646 2.68-1.702 3.981-3.016 1.244-1.256 2.08-2.599 2.18-3.93l.01-.267V6.577zm2.27 6.278-.017.43c-.156 2.128-1.446 3.959-2.824 5.35-1.308 1.321-2.83 2.381-3.971 3.088l-.464.282a3.62 3.62 0 0 1-3.482.12l-.219-.12c-1.166-.691-2.939-1.86-4.434-3.37C1.462 16.98.172 15.148.016 13.02L0 12.59V6.577c0-1.574.895-3.012 2.309-3.705l5-2.45.217-.1a4.13 4.13 0 0 1 3.415.1l5 2.45a4.13 4.13 0 0 1 2.31 3.705z" />
            <path d="M11.83 7.828a1.125 1.125 0 0 1 1.59 1.591l-4.5 4.5c-.44.439-1.152.44-1.59 0l-2-2-.078-.086a1.125 1.125 0 0 1 1.583-1.582l.085.078 1.204 1.204z" />
        </svg>
    );
}
