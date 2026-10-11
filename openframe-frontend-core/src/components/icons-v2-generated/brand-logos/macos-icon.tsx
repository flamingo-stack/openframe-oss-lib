import type { SVGProps } from "react";
export interface MacosIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function MacosIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: MacosIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill={color}
            viewBox="0 0 16 16"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path d="M12.213 8.418c-.016-1.687 1.375-2.497 1.438-2.536-.783-1.147-2-1.305-2.433-1.322-1.035-.106-2.02.611-2.547.611-.526 0-1.336-.597-2.195-.579-1.13.016-2.171.658-2.754 1.671-1.171 2.036-.298 5.06.846 6.715.56.81 1.225 1.721 2.1 1.688.845-.034 1.163-.547 2.18-.547s1.305.547 2.195.53c.907-.017 1.481-.826 2.037-1.638.638-.941.903-1.85.92-1.898-.022-.008-1.768-.68-1.787-2.695M10.54 3.463c.465-.565.778-1.348.693-2.13-.67.028-1.48.447-1.96 1.012-.43.499-.807 1.296-.704 2.062.743.058 1.506-.381 1.97-.944" />
        </svg>
    );
}
