package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import com.microsoft.playwright.options.WaitUntilState;

import static com.microsoft.playwright.options.LoadState.NETWORKIDLE;
import static com.openframe.test.config.EnvironmentConfig.getAuthUrl;

/**
 * Step 1 – the public landing / auth entry page.
 * URL: https://openframe.build/auth
 * <p>
 * The left panel is a single card fronted by a Sign Up / Login segmented
 * toggle:
 * • "Sign Up"  → "Create Organization" form (out of scope)
 * • "Login"    → "Login to OpenFrame" email form (login entry point)
 * <p>
 * Selecting "Login" navigates to /auth/login and shows a single email field.
 * Submitting the email reveals the auth-method picker inline (see
 * {@link AuthMethodPage}) – the URL stays /auth/login, there is no further
 * navigation.
 */
public class AuthEntryPage {

    public static final String URL = getAuthUrl() + "auth";

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────
    // Buttons are matched by their rendered text via Playwright's :has-text(),
    // which selects the ancestor <button>. A plain :text-is() binds to the
    // inner label <span> (never the button), and these buttons expose no
    // accessible name for getByRole() – so :has-text() is the reliable option.
    private static final String SIGN_UP_TAB = "button:has-text('Sign Up')";
    private static final String LOGIN_TAB = "button:has-text('Login')";
    private static final String FORGOT_PWD = "button:has-text('Forgot Password?')";
    // The OpenFrame provider button – used as the "email accepted" signal.
    // It is the only provider that appears in response to the email: Google,
    // Microsoft and Apple render upfront, before anything is typed, so waiting
    // on one of those would pass instantly and prove nothing.
    // Labelled "OpenFrame SSO" until 2026-09; the rename to "Continue with
    // OpenFrame" is what broke every UI case at BaseUITest.newContext.
    private static final String SSO_BTN = "button:has-text('Continue with OpenFrame')";
    // Login email form (shown once the Login tab is active)
    private static final String PAGE_HEADING = "h1:has-text('Login to OpenFrame')";
    private static final String EMAIL_INPUT = "input[type='email']";

    public AuthEntryPage(Page page) {
        this.page = page;
    }

    // ── Navigation ────────────────────────────────────────────────────────

    public AuthEntryPage navigate() {
        page.navigate(URL, new Page.NavigateOptions()
                .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                .setTimeout(60_000));
        page.waitForLoadState(NETWORKIDLE);
        return this;
    }

    // ── Locators ──────────────────────────────────────────────────────────

    public Locator signUpTab() {
        return page.locator(SIGN_UP_TAB);
    }

    public Locator loginTab() {
        return page.locator(LOGIN_TAB);
    }

    public Locator loginHeading() {
        return page.locator(PAGE_HEADING);
    }

    public Locator emailInput() {
        return page.locator(EMAIL_INPUT);
    }

    public Locator forgotPasswordLink() {
        return page.locator(FORGOT_PWD);
    }

    private Locator ssoButton() {
        return page.locator(SSO_BTN);
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Selects the "Login" tab and waits for the login email form at
     * /auth/login to render.
     * <p>
     * Waits for the email field only. The auth-method buttons are <em>not</em>
     * on screen yet: the provider list renders the OpenFrame SSO option once a
     * valid email has been entered, so waiting for it here would block on a
     * button that only this method's caller can cause to appear. That wait
     * belongs after the email is typed, and {@link #submitEmail(String)} does
     * it there.
     * <p>
     * Racing input against hydration is handled where it actually occurs, in
     * {@link #enterEmail(String)}, which re-fills until the input reports the
     * value back.
     */
    public AuthEntryPage switchToLogin() {
        loginTab().click();
        page.waitForURL(
                url -> url.contains("/auth/login"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        emailInput().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(10_000));
        return this;
    }

    /**
     * Types the given email into the login email field and waits for the
     * field to actually hold the value.
     * <p>
     * The login form re-mounts when switching to the Login tab, and a value
     * filled during that hydration window can be dropped by the controlled
     * input. We therefore re-fill until the input reports the expected value,
     * which confirms the field has settled after hydration.
     */
    public AuthEntryPage enterEmail(String email) {
        Locator input = emailInput();
        input.fill(email);
        page.waitForCondition(
                () -> {
                    if (email.equals(input.inputValue())) {
                        return true;
                    }
                    input.fill(email);
                    return false;
                },
                new Page.WaitForConditionOptions().setTimeout(15_000)
        );
        return this;
    }

    /**
     * Enters the email and returns the auth-method picker, which is rendered
     * inline on the same /auth/login screen. Clicking a provider (see
     * {@link AuthMethodPage}) auto-waits for it to become actionable once the
     * email is accepted.
     */
    public AuthMethodPage submitEmail(String email) {
        enterEmail(email);
        ssoButton().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(10_000));
        return new AuthMethodPage(page);
    }
}
