import { Download01Icon } from '../icons-v2-generated/interface/download-01-icon';
import { Button, type ButtonProps } from './button/button';

export type DownloadButtonProps = Omit<ButtonProps, 'leftIcon' | 'children'> & {
  /** What is downloaded, as the button says it ("Download PDF"). */
  label: string;
};

/**
 * THE download button: a regular small outline `Button` with the download
 * glyph, wherever a surface hands the reader a file of what it shows (the Trust
 * Center's PDF, the margin report's PDF). One look and one size, so a download
 * reads the same on every page and never louder than the page's own action.
 *
 * With `href` it is a link that opens in a new tab (an attachment downloads
 * there without leaving the page). With `onClick` the host fetches the file
 * itself and passes `loading` while it does.
 */
export function DownloadButton({ label, variant = 'outline', size = 'small', href, ...props }: DownloadButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      leftIcon={<Download01Icon aria-hidden="true" />}
      href={href}
      {...(href ? { openInNewTab: true, prefetch: false } : {})}
      {...props}
    >
      {label}
    </Button>
  );
}
