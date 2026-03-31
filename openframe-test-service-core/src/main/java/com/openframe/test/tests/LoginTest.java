package com.openframe.test.tests;

import com.microsoft.playwright.*;
import com.openframe.test.pages.AuthEntryPage;
import com.openframe.test.pages.AuthMethodPage;
import com.openframe.test.pages.DashboardPage;
import com.openframe.test.pages.SsoLoginPage;
import org.junit.jupiter.api.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end login tests covering the full 3-step authentication flow:
 * <p>
 * Step 1  openframe.build/auth/          → enter email
 * Step 2  openframe.build/auth/login/    → choose "Sign in with OpenFrame SSO"
 * Step 3  openframe.build/sas/login      → enter email + password → submit
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LoginTest {

    // ── Test credentials ──────────────────────────────────────────────────
    private static final String VALID_EMAIL = "qa@flamingo.cx";
    private static final String VALID_PASSWORD = "Test123!";
    private static final String WRONG_PASSWORD = "WrongPassword!";
    private static final String INVALID_EMAIL = "notanemail";

    private static Playwright playwright;
    private static Browser browser;

    private BrowserContext context;
    private Page page;

    // ── Lifecycle ─────────────────────────────────────────────────────────

    @BeforeAll
    static void launchBrowser() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(
                new BrowserType.LaunchOptions().setHeadless(false)
        );
    }

    @AfterAll
    static void closeBrowser() {
        browser.close();
        playwright.close();
    }

    @BeforeEach
    void newContext() {
        context = browser.newContext();
        page = context.newPage();
    }

    @AfterEach
    void closeContext() {
        context.close();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private AuthEntryPage authEntryPage() {
        return new AuthEntryPage(page).navigate();
    }

    // ── Step 1 tests ──────────────────────────────────────────────────────

    /**
     * TC-LGN-01: The auth entry page loads and the login card is visible.
     */
    @Test
    @Order(1)
    void authEntryPageLoads() {
        AuthEntryPage entryPage = authEntryPage();

        assertThat(entryPage.loginCardHeading().isVisible())
                .as("'Already Have an Account?' heading must be visible")
                .isTrue();

        assertThat(entryPage.emailInput().isVisible())
                .as("Email input must be visible in the login card")
                .isTrue();
    }

    /**
     * TC-LGN-02: The Continue button is disabled until a valid email is typed.
     */
    @Test
    @Order(2)
    void continueButtonDisabledWithEmptyEmail() {
        AuthEntryPage entryPage = authEntryPage();

        assertThat(entryPage.isContinueEnabled())
                .as("Continue button must be disabled when email is empty")
                .isFalse();
    }

    /**
     * TC-LGN-03: The Continue button becomes enabled once a valid email is entered.
     */
    @Test
    @Order(3)
    void continueButtonEnabledAfterEmailEntry() {
        AuthEntryPage entryPage = authEntryPage().enterEmail(VALID_EMAIL);

        assertThat(entryPage.isContinueEnabled())
                .as("Continue button must be enabled after entering a valid email")
                .isTrue();
    }

    // ── Step 2 tests ──────────────────────────────────────────────────────

    /**
     * TC-LGN-04: Submitting a valid email navigates to the auth-method picker.
     */
    @Test
    @Order(4)
    void emailSubmitNavigatesToMethodPicker() {
        AuthMethodPage methodPage = authEntryPage().submitEmail(VALID_EMAIL);

        assertThat(page.url())
                .as("URL must be /auth/login/ after submitting email")
                .contains("/auth/login/");

        assertThat(methodPage.ssoButton().isVisible())
                .as("'Sign in with OpenFrame SSO' button must be visible")
                .isTrue();

        assertThat(methodPage.microsoftButton().isVisible())
                .as("'Continue with Microsoft' button must be visible")
                .isTrue();

        assertThat(methodPage.googleButton().isVisible())
                .as("'Continue with Google' button must be visible")
                .isTrue();
    }

    /**
     * TC-LGN-05: The Back button on the method picker returns to /auth/.
     */
    @Test
    @Order(5)
    void backButtonReturnsToAuthEntryPage() {
        AuthEntryPage returnedPage = authEntryPage()
                .submitEmail(VALID_EMAIL)
                .clickBack();

        assertThat(page.url())
                .as("URL must be /auth/ after clicking Back")
                .contains("/auth/");

        assertThat(returnedPage.emailInput().isVisible())
                .as("Email input must be visible on the returned auth entry page")
                .isTrue();
    }

    // ── Step 3 tests ──────────────────────────────────────────────────────

    /**
     * TC-LGN-06: Clicking SSO navigates to the SSO credential form.
     */
    @Test
    @Order(6)
    void ssoButtonNavigatesToCredentialForm() {
        SsoLoginPage ssoPage = authEntryPage()
                .submitEmail(VALID_EMAIL)
                .clickSignInWithOpenFrameSso();

        assertThat(page.url())
                .as("URL must contain /sas/login")
                .contains("/sas/login");

        assertThat(ssoPage.formHeading().isVisible())
                .as("'OpenFrame Single Sign-On' heading must be visible")
                .isTrue();

        assertThat(ssoPage.emailInput().isVisible())
                .as("Email input must be visible on the SSO form")
                .isTrue();

        assertThat(ssoPage.passwordInput().isVisible())
                .as("Password input must be visible on the SSO form")
                .isTrue();
    }

    // ── Happy-path ────────────────────────────────────────────────────────

    /**
     * TC-LGN-07 (primary): Full login flow with valid credentials lands
     * on the Dashboard.
     */
    @Test
    @Order(7)
    void successfulLoginLandsOnDashboard() {
        DashboardPage dashboard = authEntryPage()
                .submitEmail(VALID_EMAIL)
                .clickSignInWithOpenFrameSso()
                .login(VALID_EMAIL, VALID_PASSWORD);

        assertThat(dashboard.getCurrentUrl())
                .as("URL must contain /dashboard/ after successful login")
                .contains("/dashboard/");

        assertThat(dashboard.userBadge().isVisible())
                .as("User badge must be visible in the app header after login")
                .isTrue();

        assertThat(dashboard.sidebar().isVisible())
                .as("Navigation sidebar must be visible after login")
                .isTrue();
    }

    // ── Failure-path ──────────────────────────────────────────────────────

    /**
     * TC-LGN-08: Wrong password keeps the user on the SSO login page.
     */
    @Test
    @Order(8)
    void wrongPasswordStaysOnSsoLoginPage() {
        SsoLoginPage ssoPage = authEntryPage()
                .submitEmail(VALID_EMAIL)
                .clickSignInWithOpenFrameSso()
                .enterEmail(VALID_EMAIL)
                .enterPassword(WRONG_PASSWORD);

        // Submit and expect to remain on /sas/login
        ssoPage.submitButton().click();
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);

        assertThat(page.url())
                .as("URL must remain at /sas/login after wrong password")
                .contains("/sas/login");

        assertThat(ssoPage.isLoginFailed())
                .as("isLoginFailed() must return true after wrong password")
                .isTrue();
    }

    /**
     * TC-LGN-09: After a failed attempt the email field retains its value.
     */
    @Test
    @Order(9)
    void emailFieldRetainedAfterFailedLogin() {
        SsoLoginPage ssoPage = authEntryPage()
                .submitEmail(VALID_EMAIL)
                .clickSignInWithOpenFrameSso()
                .enterEmail(VALID_EMAIL)
                .enterPassword(WRONG_PASSWORD);

        ssoPage.submitButton().click();
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);

        assertThat(ssoPage.getEmailValue())
                .as("Email field must retain its value after a failed login")
                .isEqualTo(VALID_EMAIL);
    }
}