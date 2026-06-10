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
    // User avatar badge in the top-right header (shows initials, e.g. "TQ")
    private static final String USER_BADGE = "button[aria-label='User']";
    // Main content heading
    private static final String PAGE_HEADING = "main h1, main h2";
    // Sidebar – reliable indicator the app shell loaded correctly
    private static final String SIDEBAR = "aside[aria-label='Main navigation sidebar']";
    // Dashboard nav item is marked active (aria-current="page") only once the
    // dashboard route has actually rendered – a concrete "we are on the
    // dashboard" element to wait on rather than relying on the URL alone.
    private static final String DASHBOARD_NAV_ACTIVE =
            SIDEBAR + " button[aria-label='Dashboard'][aria-current='page']";

    public DashboardPage(Page page) {
        this.page = page;
    }

    // ── Locators ──────────────────────────────────────────────────────────

    public Locator userBadge() {
        return page.locator(USER_BADGE);
    }

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

    public boolean isLoaded() {
        return page.url().contains(URL_FRAGMENT)
                && sidebar().isVisible()
                && userBadge().isVisible()
                && dashboardNavActive().isVisible();
    }

    public String getCurrentUrl() {
        return page.url();
    }

    public String getUserBadgeText() {
        return userBadge().innerText().trim();
    }
}