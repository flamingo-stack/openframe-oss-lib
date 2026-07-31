package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Step 2 – authentication method picker.
 * URL: https://openframe.build/auth/login
 * <p>
 * Revealed inline (no navigation) after the email is submitted in Step 1 –
 * the email field is replaced by the provider buttons on the same
 * /auth/login page. Offers OpenFrame SSO, Google, and Microsoft as sign-in
 * providers.
 */
public class AuthMethodPage {

    public static final String URL = "https://openframe.build/auth/login";

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────
    // Matched by rendered text via :has-text(), which selects the ancestor
    // <button>. The visible label sits in a <span> next to a provider icon,
    // so a plain :text-is() would bind to the inner <span> and never match
    // the button; these buttons also expose no accessible name for getByRole().
    private static final String SSO_BTN = "button:has-text('OpenFrame SSO')";
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
     * Clicks "OpenFrame SSO" and waits for navigation to the SSO credential
     * form at /sas/login.
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
