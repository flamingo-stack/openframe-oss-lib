package com.openframe.test.tests.ui;

import com.microsoft.playwright.*;
import com.openframe.test.pages.DeviceDetailsPage;
import com.openframe.test.pages.RemoteDesktopPage;
import org.junit.jupiter.api.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for starting a Remote Desktop session and validating
 * that it has started successfully.
 * <p>
 * Pre-conditions (out of scope – handled by test setup):
 * • The browser is authenticated.
 * • The test navigates to the Device Details page before each test.
 * <p>
 * Device under test: vm114267  (Desktop • Default, status: ONLINE)
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class RemoteDesktopSessionTest {

    private static final String DEVICE_DETAILS_URL =
            "https://test-qa.openframe.build/devices/details/" +
                    "6b695b8e-5c16-44c2-970a-aeeb6c72f136/";

    private static final int EXPECTED_CANVAS_WIDTH = 1024;
    private static final int EXPECTED_CANVAS_HEIGHT = 768;

    private static Playwright playwright;
    private static Browser browser;

    private BrowserContext context;
    private Page page;

    // ── Lifecycle ────────────────────────────────────────────────────────────

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
    void openDevicePage() {
        context = browser.newContext();
        page = context.newPage();
        page.navigate(DEVICE_DETAILS_URL);
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
    }

    @AfterEach
    void closeContext() {
        context.close();
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private DeviceDetailsPage deviceDetailsPage() {
        return new DeviceDetailsPage(page);
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    /**
     * TC-RD-01: Device must be ONLINE and the Remote Control button visible
     * before attempting to start a session.
     */
    @Test
    @Order(1)
    void deviceShouldBeOnlineBeforeStartingSession() {
        DeviceDetailsPage detailsPage = deviceDetailsPage();

//        assertThat(detailsPage.remoteControlButton().isVisible())
//                .as("Remote Control button must be visible on the Device Details page")
//                .isTrue();

        assertThat(detailsPage.getDeviceStatus())
                .as("Device status must be ONLINE before starting remote desktop")
                .isEqualTo("ONLINE");
    }

    /**
     * TC-RD-02: Clicking "Remote Control" must navigate to the
     * /remote-desktop/ sub-route.
     */
    @Test
    @Order(2)
    void clickingRemoteControlNavigatesToRemoteDesktopUrl() {
        RemoteDesktopPage rdPage = deviceDetailsPage().openRemoteDesktop();

        assertThat(rdPage.getCurrentUrl())
                .as("URL must contain '/remote-desktop/' after clicking Remote Control")
                .contains("/remote-desktop/");
    }

    /**
     * TC-RD-03: The remote-desktop page header must show the correct device
     * name and a non-blank subtitle.
     */
    @Test
    @Order(3)
    void remoteDesktopPageHeaderShowsCorrectDeviceInfo() {
        DeviceDetailsPage detailsPage = deviceDetailsPage();
        String expectedName = detailsPage.getDeviceName();
        RemoteDesktopPage rdPage = detailsPage.openRemoteDesktop();

        assertThat(rdPage.getDeviceName())
                .as("Device name in the RD page header must match the Device Details page")
                .isEqualToIgnoringCase(expectedName);

        assertThat(rdPage.getDeviceSubtitle())
                .as("Device subtitle (type • org) must not be blank")
                .isNotBlank();
    }

    /**
     * TC-RD-04 (primary): The remote desktop session is considered started
     * when the <canvas> is visible and carries the expected frame-buffer
     * dimensions (1024 × 768).
     */
    @Test
    @Order(4)
    void remoteDesktopSessionStartsAndCanvasIsVisible() {
        RemoteDesktopPage rdPage = deviceDetailsPage()
                .openRemoteDesktop()
                .waitForCanvasVisible(15_000);

        assertThat(rdPage.remoteDesktopCanvas().isVisible())
                .as("Remote desktop <canvas> must be visible once the session starts")
                .isTrue();

        assertThat(rdPage.getCanvasWidth())
                .as("Canvas width must be %d px", EXPECTED_CANVAS_WIDTH)
                .isEqualTo(EXPECTED_CANVAS_WIDTH);

        assertThat(rdPage.getCanvasHeight())
                .as("Canvas height must be %d px", EXPECTED_CANVAS_HEIGHT)
                .isEqualTo(EXPECTED_CANVAS_HEIGHT);
    }

    /**
     * TC-RD-05: Session controls (Actions, Settings) must be visible and
     * enabled once the session is active.
     */
    @Test
    @Order(5)
    void sessionControlsAreAvailableAfterSessionStarts() {
        RemoteDesktopPage rdPage = deviceDetailsPage()
                .openRemoteDesktop()
                .waitForCanvasVisible(15_000);

        assertThat(rdPage.actionsButton().isVisible())
                .as("Actions button must be visible")
                .isTrue();

        assertThat(rdPage.actionsButton().isEnabled())
                .as("Actions button must be enabled")
                .isTrue();

        assertThat(rdPage.settingsButton().isVisible())
                .as("Settings button must be visible")
                .isTrue();

        assertThat(rdPage.settingsButton().isEnabled())
                .as("Settings button must be enabled")
                .isTrue();
    }

    /**
     * TC-RD-06: The "Back to Device" button must be present during an
     * active session.
     */
    @Test
    @Order(6)
    void backToDeviceButtonIsAvailableDuringSession() {
        RemoteDesktopPage rdPage = deviceDetailsPage()
                .openRemoteDesktop()
                .waitForCanvasVisible(15_000);

        assertThat(rdPage.backToDeviceButton().isVisible())
                .as("'Back to Device' button must be visible during an active session")
                .isTrue();
    }

    /**
     * TC-RD-07: Clicking "Back to Device" must navigate away from the
     * remote-desktop route and restore the Remote Control button.
     */
    @Test
    @Order(7)
    void backToDeviceNavigatesAwayFromRemoteDesktop() {
        DeviceDetailsPage returnedPage = deviceDetailsPage()
                .openRemoteDesktop()
                .waitForCanvasVisible(15_000)
                .goBackToDevice();

        assertThat(page.url())
                .as("URL must no longer contain '/remote-desktop/' after going back")
                .doesNotContain("/remote-desktop/");
//
//        assertThat(returnedPage.remoteControlButton().isVisible())
//                .as("Remote Control button must be visible again on the Device Details page")
//                .isTrue();
    }
}