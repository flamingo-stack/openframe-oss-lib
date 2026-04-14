package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Step 3 – OpenFrame SSO credential form.
 * URL: https://openframe.build/sas/login
 * <p>
 * Server-rendered form (id="loginForm", method POST).
 * Fields use stable id attributes: #username and #password.
 * <p>
 * Success:  POST redirects to test-qa.openframe.build/dashboard/
 * Failure:  POST redirects back to GET /sas/login; fields retain values,
 * no inline error message is shown.
 */
public class SsoLoginPage {

    public static final String URL = "https://openframe.build/sas/login";

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────
    private static final String FORM_HEADING = "h2:has-text('OpenFrame Single Sign-On')";
    private static final String EMAIL_INPUT = "#username";
    private static final String PASSWORD_INPUT = "#password";
    private static final String SUBMIT_BTN = "#submitBtn";           // type="submit"
    private static final String FORGOT_PWD_BTN = "#forgotPasswordBtn";  // type="button"
    private static final String TOGGLE_PWD_BTN = "#passwordToggle";     // eye icon

    // Post-login landing host
    private static final String DASHBOARD_URL_FRAGMENT = "/dashboard/";

    public SsoLoginPage(Page page) {
        this.page = page;
    }

    // ── Locators ──────────────────────────────────────────────────────────

    public Locator formHeading() {
        return page.locator(FORM_HEADING);
    }

    public Locator emailInput() {
        return page.locator(EMAIL_INPUT);
    }

    public Locator passwordInput() {
        return page.locator(PASSWORD_INPUT);
    }

    public Locator submitButton() {
        return page.locator(SUBMIT_BTN);
    }

    public Locator forgotPasswordButton() {
        return page.locator(FORGOT_PWD_BTN);
    }

    public Locator togglePasswordButton() {
        return page.locator(TOGGLE_PWD_BTN);
    }

    // ── Queries ───────────────────────────────────────────────────────────

    /**
     * Returns {@code true} if the page URL is still /sas/login
     * (indicating a failed login attempt).
     */
    public boolean isLoginFailed() {
        return page.url().contains("/sas/login");
    }

    /**
     * Returns the current value of the email field (retained after failure).
     */
    public String getEmailValue() {
        return emailInput().inputValue();
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Fills the email (username) field.
     */
    public SsoLoginPage enterEmail(String email) {
        emailInput().fill(email);
        return this;
    }

    /**
     * Fills the password field.
     */
    public SsoLoginPage enterPassword(String password) {
        passwordInput().fill(password);
        return this;
    }

    /**
     * Clicks the Submit button and waits for navigation.
     * On success, returns a {@link DashboardPage}.
     * On failure, the browser stays at /sas/login – the caller
     * should check {@link #isLoginFailed()} before using the returned object.
     */
    public DashboardPage clickSubmit() {
        submitButton().click();
        page.waitForURL(
                url -> !url.contains("/sas/login"),
                new Page.WaitForURLOptions().setTimeout(15_000)
        );
        return new DashboardPage(page);
    }

    /**
     * Convenience: fills both fields and submits.
     */
    public DashboardPage login(String email, String password) {
        return enterEmail(email)
                .enterPassword(password)
                .clickSubmit();
    }
}