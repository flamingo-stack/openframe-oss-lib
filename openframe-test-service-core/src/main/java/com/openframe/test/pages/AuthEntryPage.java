package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

import static com.microsoft.playwright.options.LoadState.NETWORKIDLE;
import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;

/**
 * Step 1 – the public landing / auth entry page.
 * URL: https://openframe.build/auth/
 * <p>
 * Contains two cards:
 * • "Create Organization"  (out of scope)
 * • "Already Have an Account?"  ← login entry point
 * <p>
 * The login card is uniquely identified by its outer wrapper:
 * div.bg-ods-bg.border.border-ods-border  that contains h1 "Already Have an Account?"
 */
public class AuthEntryPage {

    public static final String URL = getAuthUrl() + "auth/";

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────
    // Scoped to the login card to avoid collision with "Create Organization" card
    private static final String LOGIN_CARD = "div.bg-ods-bg.border.border-ods-border:has(h1:has-text('Already Have an Account'))";
    private static final String EMAIL_INPUT = LOGIN_CARD + " input[type='email']";
    private static final String CONTINUE_BTN = LOGIN_CARD + " button:has-text('Continue')";
    private static final String FORGOT_PWD = LOGIN_CARD + " button:has-text('Forgot password')";
    private static final String PAGE_HEADING = LOGIN_CARD + " h1";

    public AuthEntryPage(Page page) {
        this.page = page;
    }

    // ── Navigation ────────────────────────────────────────────────────────

    public AuthEntryPage navigate() {
        page.navigate(URL);
        page.waitForLoadState(NETWORKIDLE);
        return this;
    }

    // ── Locators ──────────────────────────────────────────────────────────

    public Locator loginCardHeading() {
        return page.locator(PAGE_HEADING);
    }

    public Locator emailInput() {
        return page.locator(EMAIL_INPUT);
    }

    public Locator continueButton() {
        return page.locator(CONTINUE_BTN);
    }

    public Locator forgotPasswordLink() {
        return page.locator(FORGOT_PWD);
    }

    // ── Queries ───────────────────────────────────────────────────────────

    public boolean isContinueEnabled() {
        return continueButton().isEnabled();
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Types the given email into the login card's email field.
     * The Continue button becomes enabled once a non-empty value is present.
     */
    public AuthEntryPage enterEmail(String email) {
        emailInput().fill(email);
        return this;
    }

    /**
     * Clicks Continue and waits for navigation to /auth/login/.
     * Returns the next-step page object.
     */
    public AuthMethodPage clickContinue() {
        continueButton().click();
        page.waitForURL(
                url -> url.contains("/auth/login/"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        return new AuthMethodPage(page);
    }

    /**
     * Convenience: enters email and proceeds to step 2.
     */
    public AuthMethodPage submitEmail(String email) {
        return enterEmail(email).clickContinue();
    }
}