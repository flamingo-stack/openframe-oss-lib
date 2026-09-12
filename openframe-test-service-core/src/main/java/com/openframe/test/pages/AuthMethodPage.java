package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.openframe.test.config.EnvironmentConfig;

/**
 * Step 2 – authentication method picker.
 * URL: https://openframe.build/auth/login
 * <p>
 * Revealed inline (no navigation) on the same /auth/login page as Step 1.
 * <p>
 * Google, Microsoft and Apple render upfront; the email field sits below them
 * under "or enter email to continue with custom SSO", and entering an email
 * adds the OpenFrame provider to the list. The email field is not replaced.
 */
public class AuthMethodPage {

    public static final String URL = EnvironmentConfig.getAuthUrl() + "auth/login";

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────
    // Matched by rendered text via :has-text(), which selects the ancestor
    // <button>. The visible label sits in a <span> next to a provider icon,
    // so a plain :text-is() would bind to the inner <span> and never match
    // the button; these buttons also expose no accessible name for getByRole().
    // Renamed from "OpenFrame SSO" in 2026-09; see AuthEntryPage for the fallout.
    private static final String SSO_BTN = "button:has-text('Continue with OpenFrame')";
    private static final String GOOGLE_BTN = "button:has-text('Continue with Google')";
    private static final String MICROSOFT_BTN = "button:has-text('Continue with Microsoft')";

    public AuthMethodPage(Page page) {
        this.page = page;
    }

    // ── Locators ──────────────────────────────────────────────────────────

    public Locator ssoButton() {
        return page.locator(SSO_BTN);
    }

    public Locator googleButton() {
        return page.locator(GOOGLE_BTN);
    }

    public Locator microsoftButton() {
        return page.locator(MICROSOFT_BTN);
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Clicks "Continue with OpenFrame" and waits for navigation to the SSO
     * credential form at /sas/login.
     */
    public SsoLoginPage clickSignInWithOpenFrameSso() {
        ssoButton().click();
        page.waitForURL(
                url -> url.contains("/sas/login"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        return new SsoLoginPage(page);
    }
}
