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
    // First auth-method button – used as the "email accepted" signal once the
    // method picker is revealed after Continue.
    private static final String SSO_BTN = "button:has-text('OpenFrame SSO')";
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
     * /auth/login to render. The email field and the auth-method buttons
     * (OpenFrame SSO / Google / Microsoft) render together on this single
     * screen – there is no separate Continue step – so we wait for both the
     * email field and the SSO button before returning, to avoid racing input
     * against hydration.
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
        ssoButton().waitFor(new Locator.WaitForOptions()
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
