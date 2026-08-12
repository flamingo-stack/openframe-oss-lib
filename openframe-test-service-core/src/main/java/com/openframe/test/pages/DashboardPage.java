package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Post-login landing page (Dashboard).
 * URL: https://test-qa.openframe.build/dashboard/
 * <p>
 * Used primarily for login-success assertions.
 */
public class DashboardPage {

    // Match both "/dashboard" and "/dashboard/" — the trailing slash is not
    // guaranteed across environments.
    public static final String URL_FRAGMENT = "/dashboard";

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────
    // There is deliberately no user-badge selector here. The top-right header
    // now holds only Time tracker / Notifications / Mingo AI; the avatar, name,
    // email and Log Out moved into <div role="dialog" aria-label="Mobile
    // navigation menu">, which is display:none at the 1920x1080 viewport these
    // tests run at. The block also carries no aria-label, role or data-testid —
    // nothing stable to bind to — so do not reintroduce one, and above all do
    // not put it back into isLoaded().
    // Main content heading
    private static final String PAGE_HEADING = "main h1, main h2";
    // Sidebar – reliable indicator the app shell loaded correctly
    private static final String SIDEBAR = "aside[aria-label='Main navigation sidebar']";
    // Dashboard nav item is marked active (aria-current="page") only once the
    // dashboard route has actually rendered – a concrete "we are on the
    // dashboard" element to wait on rather than relying on the URL alone.
    //
    // Tag-agnostic on purpose. The frontend picks the element per item state:
    // a navigable entry renders as <a href> (Next <Link>, for prefetch), while
    // a disabled one or one with a custom onClick and no path stays a <button>
    // (openframe-frontend-core navigation-sidebar-item.tsx). Pinning the tag
    // broke login for every UI test when navigable items became anchors.
    private static final String DASHBOARD_NAV_ACTIVE =
            SIDEBAR + " :is(a, button)[aria-label='Dashboard'][aria-current='page']";

    public DashboardPage(Page page) {
        this.page = page;
    }

    // ── Locators ──────────────────────────────────────────────────────────

    public Locator pageHeading() {
        return page.locator(PAGE_HEADING).first();
    }

    public Locator sidebar() {
        return page.locator(SIDEBAR);
    }

    public Locator dashboardNavActive() {
        return page.locator(DASHBOARD_NAV_ACTIVE);
    }

    // ── Queries ───────────────────────────────────────────────────────────

    /**
     * Whether the dashboard has finished rendering.
     *
     * <p>{@code UILoginFlow} polls this through {@code waitForCondition} with no explicit timeout, so
     * every condition here has to be reachable at the test viewport or the whole UI suite fails on
     * Playwright's 30s default — which is exactly what a user-badge check did once the avatar moved
     * into the mobile-only drawer.
     *
     * <p>The three checks below are deliberately the whole set: the URL, the app shell, and the
     * dashboard nav item marked {@code aria-current="page"}, which the router sets only after the
     * route actually renders. Add a fourth only if it is visible at 1920x1080.
     */
    public boolean isLoaded() {
        return page.url().contains(URL_FRAGMENT)
                && sidebar().isVisible()
                && dashboardNavActive().isVisible();
    }

    public String getCurrentUrl() {
        return page.url();
    }
}