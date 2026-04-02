package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

import static com.microsoft.playwright.options.WaitForSelectorState.VISIBLE;

/**
 * Page Object for the Remote Desktop session page.
 * URL pattern: /devices/details/{deviceId}/remote-desktop/
 * <p>
 * The remote desktop stream is rendered onto a {@code <canvas>} element
 * using noVNC / MeshCentral. The session is considered "started" when:
 * 1. The URL contains "/remote-desktop/"
 * 2. The <canvas> element is visible and has non-zero dimensions (1024×768)
 * 3. The device name heading and subtitle are present in the header
 * 4. The "Actions" and "Settings" controls are available
 */
public class RemoteDesktopPage {

    private final Page page;

    // ── Selectors ────────────────────────────────────────────────────────────

    // Remote desktop canvas – identified by its unique tabindex + class
    private static final String REMOTE_DESKTOP_CANVAS = "canvas[tabindex='0']";

    // Device name heading inside the remote-desktop header
    private static final String DEVICE_NAME_HEADING = "main h1";

    // Subtitle "Desktop • Default" rendered in a <p> below the h1
    private static final String DEVICE_SUBTITLE = "main h1 + p";

    // "Actions" dropdown trigger (Radix UI, aria-haspopup="menu")
    private static final String ACTIONS_BUTTON =
            "main button[aria-haspopup='menu']:has-text('Actions')";

    // "Settings" button (no aria-haspopup – plain submit button)
    private static final String SETTINGS_BUTTON =
            "main button:not([aria-haspopup]):has-text('Settings')";

    // "Back to Device" navigation button
    private static final String BACK_TO_DEVICE_BUTTON =
            "main button:has-text('Back to Device')";

    // ── Constructor ──────────────────────────────────────────────────────────
    public RemoteDesktopPage(Page page) {
        this.page = page;
    }

    // ── Accessors ────────────────────────────────────────────────────────────

    public Locator remoteDesktopCanvas() {
        return page.locator(REMOTE_DESKTOP_CANVAS);
    }

    public Locator deviceNameHeading() {
        return page.locator(DEVICE_NAME_HEADING);
    }

    public Locator deviceSubtitle() {
        return page.locator(DEVICE_SUBTITLE);
    }

    public Locator actionsButton() {
        return page.locator(ACTIONS_BUTTON);
    }

    public Locator settingsButton() {
        return page.locator(SETTINGS_BUTTON);
    }

    public Locator backToDeviceButton() {
        return page.locator(BACK_TO_DEVICE_BUTTON);
    }

    // ── Derived state ────────────────────────────────────────────────────────

    /**
     * Returns the current page URL.
     */
    public String getCurrentUrl() {
        return page.url();
    }

    /**
     * Returns the device name shown in the remote-desktop page header.
     */
    public String getDeviceName() {
        return deviceNameHeading().innerText().trim();
    }

    /**
     * Returns the device subtitle (e.g. "Desktop • Default").
     */
    public String getDeviceSubtitle() {
        return deviceSubtitle().innerText().trim();
    }

    /**
     * Returns the rendered width of the remote-desktop canvas in pixels
     * as reported by the DOM attribute.
     */
    public int getCanvasWidth() {
        String w = remoteDesktopCanvas().getAttribute("width");
        return w != null ? Integer.parseInt(w) : 0;
    }

    /**
     * Returns the rendered height of the remote-desktop canvas in pixels.
     */
    public int getCanvasHeight() {
        String h = remoteDesktopCanvas().getAttribute("height");
        return h != null ? Integer.parseInt(h) : 0;
    }

    /**
     * Waits until the canvas is attached to the DOM and visible.
     *
     * @param timeoutMs maximum time to wait in milliseconds
     */
    public RemoteDesktopPage waitForCanvasVisible(int timeoutMs) {
        remoteDesktopCanvas()
                .waitFor(new Locator.WaitForOptions()
                        .setState(VISIBLE)
                        .setTimeout(timeoutMs));
        return this;
    }

    public boolean waitForDesktop() {
        page.waitForCondition(this::canvasIsNotBlank);
        return true;
    }

    public boolean canvasIsNotBlank() {
        Object isNonBlank = page.evaluate("""
                    () => {
                        const canvas = document.querySelector('canvas');
                        const ctx = canvas.getContext('2d');
                        const cx = Math.floor(canvas.width / 2);
                        const cy = Math.floor(canvas.height / 2);
                        const px = ctx.getImageData(cx, cy, 1, 1).data;
                        return (px[0] > 0 || px[1] > 0 || px[2] > 0); // R, G, or B non-zero
                    }
                """);
        return (Boolean) isNonBlank;
    }

    /**
     * Returns to the Device Details page by clicking "Back to Device".
     */
    public DeviceDetailsPage goBackToDevice() {
        backToDeviceButton().click();
        page.waitForURL(
                url -> !url.contains("/remote-desktop/"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        return new DeviceDetailsPage(page);
    }
}