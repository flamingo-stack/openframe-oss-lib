package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Step 2 – authentication method picker.
 * URL: https://openframe.build/auth/login/
 * <p>
 * Displayed after the email is submitted in Step 1.
 * Offers OpenFrame SSO, Microsoft, and Google as sign-in providers.
 */
public class AuthMethodPage {

    public static final String URL = "https://openframe.build/auth/login/";

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────
    private static final String HEADING = "h1:has-text('Already registered')";
    private static final String SSO_BTN = "button:has-text('Sign in with OpenFrame SSO')";
    private static final String MICROSOFT_BTN = "button:has-text('Continue with Microsoft')";
    private static final String GOOGLE_BTN = "button:has-text('Continue with Google')";
    private static final String BACK_BTN = "button:has-text('Back')";

    public AuthMethodPage(Page page) {
        this.page = page;
    }

    // ── Locators ──────────────────────────────────────────────────────────

    public Locator heading() {
        return page.locator(HEADING);
    }

    public Locator ssoButton() {
        return page.locator(SSO_BTN);
    }

    public Locator microsoftButton() {
        return page.locator(MICROSOFT_BTN);
    }

    public Locator googleButton() {
        return page.locator(GOOGLE_BTN);
    }

    public Locator backButton() {
        return page.locator(BACK_BTN);
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Clicks "Sign in with OpenFrame SSO" and waits for navigation to
     * the SSO credential form at /sas/login.
     */
    public SsoLoginPage clickSignInWithOpenFrameSso() {
        ssoButton().click();
        page.waitForURL(
                url -> url.contains("/sas/login"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        return new SsoLoginPage(page);
    }

    /**
     * Clicks Back and returns to the Auth Entry page.
     */
    public AuthEntryPage clickBack() {
        backButton().click();
        page.waitForURL(
                url -> url.endsWith("/auth/"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        return new AuthEntryPage(page);
    }
}