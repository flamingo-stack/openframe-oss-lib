package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import com.microsoft.playwright.options.WaitUntilState;

import java.util.regex.Pattern;

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
    // Anchored so it does not also match "Continue with Google" / "…Microsoft"
    // once the method picker is revealed.
    private static final Pattern CONTINUE_TEXT = Pattern.compile("^\\s*Continue\\s*$");
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

    public Locator continueButton() {
        return page.locator("button")
                .filter(new Locator.FilterOptions().setHasText(CONTINUE_TEXT));
    }

    public Locator forgotPasswordLink() {
        return page.locator(FORGOT_PWD);
    }

    private Locator ssoButton() {
        return page.locator(SSO_BTN);
    }

    // ── Queries ───────────────────────────────────────────────────────────

    public boolean isContinueEnabled() {
        return continueButton().isEnabled();
    }

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Selects the "Login" tab and waits for the login email form at
     * /auth/login to render (both the email field and the Continue button
     * present), so subsequent input is not raced against hydration.
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
        continueButton().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(10_000));
        return this;
    }

    /**
     * Types the given email into the login email field and waits for the app
     * to accept it – the Continue button only becomes enabled once a valid
     * email is registered.
     * <p>
     * The login form re-mounts when switching to the Login tab, and a value
     * filled during that hydration window can be dropped by the controlled
     * input (leaving Continue permanently disabled). We therefore re-fill
     * until the button reports enabled, which is the app's own confirmation
     * that the email was accepted.
     */
    public AuthEntryPage enterEmail(String email) {
        Locator input = emailInput();
        input.fill(email);
        page.waitForCondition(
                () -> {
                    if (continueButton().isEnabled()) {
                        return true;
                    }
                    if (!email.equals(input.inputValue())) {
                        input.fill(email);
                    }
                    return false;
                },
                new Page.WaitForConditionOptions().setTimeout(15_000)
        );
        return this;
    }

    /**
     * Clicks Continue and waits for the auth-method picker to appear inline.
     * No navigation occurs – the URL stays /auth/login.
     * Returns the next-step page object.
     */
    public AuthMethodPage clickContinue() {
        continueButton().click();
        ssoButton().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(10_000));
        return new AuthMethodPage(page);
    }

    /**
     * Convenience: enters email and proceeds to the auth-method picker.
     */
    public AuthMethodPage submitEmail(String email) {
        return enterEmail(email).clickContinue();
    }
}
