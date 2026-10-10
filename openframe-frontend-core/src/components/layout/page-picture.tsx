'use client';

import { createContext, forwardRef, useContext, type HTMLAttributes, type ReactNode } from 'react';

/**
 * A PICTURE of a page: a product screen drawn inside another page (the product
 * demo's frames). The components in it are the product's real ones, so their
 * page title would be a second `<h1>` of the page that shows the picture, and a
 * search engine would read a sample runbook's name as that page's heading.
 *
 * Inside a picture a page title is drawn exactly as it is, in an element that is
 * not a heading. A component that renders a page's title renders `<PageTitle>`
 * in place of `<h1>`, and the rule holds with no prop to pass.
 */
const PagePictureContext = createContext(false);

export function PagePicture({ children }: { children: ReactNode }) {
  return <PagePictureContext.Provider value>{children}</PagePictureContext.Provider>;
}

/** True inside a picture of a page. */
export function useIsPagePicture(): boolean {
  return useContext(PagePictureContext);
}

/** A page's title: an `<h1>`, or the same box as a plain `<div>` inside a picture of a page. */
export const PageTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function PageTitleElement(props, ref) {
    const picture = useContext(PagePictureContext);
    return picture ? <div {...props} ref={ref} /> : <h1 {...props} ref={ref} />;
  },
);
