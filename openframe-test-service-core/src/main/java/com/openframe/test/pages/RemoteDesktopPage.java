package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.TimeoutError;

import com.microsoft.playwright.options.WaitForSelectorState;

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

    // ── Remote-access approval gate ──────────────────────────────────────────

    // The flow carries no test ids, so its copy is the only handle.
    private static final String AWAITING_HEADING = "main h2:has-text('Waiting for approval')";

    // Present only while remote-access-mock-tools is on, which is qa and dev.
    private static final String MOCK_APPROVE = "main button:has-text('Approve')";

    private static final String[] GATE_FAILURES = {
            "Remote access disabled",
            "Remote access declined",
            "No response",
            "Request failed"
    };

    // Short on purpose: the gate renders with the page or not at all, and stage and prod pay this.
    /** Same budget as the other MeshCentral session waits — a painting canvas is the session working. */
    private static final int DESKTOP_PAINT_MS = 60_000;
    private static final int GATE_PROBE_MS = 5_000;

    private static final int GATE_SETTLE_MS = 20_000;

    /**
     * Passes the remote-access approval gate when it is in the way.
     *
     * <p>qa and dev run with {@code remote-access-approval} on, which mounts the session component only
     * after the end user approves. There is nothing to type — the request fires on its own — so this
     * waits out the states that settle by themselves and answers the one that does not:
     *
     * <ul>
     *   <li>flag off (stage, prod), or a policy of NOTIFY_ONLY / SILENT_ACCESS: the canvas is already
     *       on its way and this returns after the probe without touching anything;</li>
     *   <li>APPROVAL_REQUIRED: the awaiting screen appears and, with {@code remote-access-mock-tools}
     *       on, carries the mock service's Approve button — which is how a headless run answers a
     *       request that is otherwise waiting on a human at the device;</li>
     *   <li>disabled, declined, no response or failed: the run stops with that screen's own words
     *       rather than a bare canvas timeout twenty seconds later.</li>
     * </ul>
     *
     * <p>Only the remote desktop is gated. Remote shell and file manager sit outside the flow, which is
     * why neither page object has any of this.
     */
    public RemoteDesktopPage clearApprovalGate() {
        Locator awaiting = page.locator(AWAITING_HEADING);
        try {
            awaiting.waitFor(new Locator.WaitForOptions()
                    .setState(VISIBLE)
                    .setTimeout(GATE_PROBE_MS));
        } catch (TimeoutError noGate) {
            failIfGateRefused();
            return this;
        }

        Locator approve = page.locator(MOCK_APPROVE);
        if (approve.count() == 0) {
            throw new AssertionError("The remote-access approval gate is waiting for the end user and the "
                    + "mock service panel is not on this environment, so nothing can answer it. "
                    + "Enable remote-access-mock-tools, or approve the request on the device.");
        }
        approve.first().click();

        awaiting.waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.HIDDEN)
                .setTimeout(GATE_SETTLE_MS));
        failIfGateRefused();
        return this;
    }

    private void failIfGateRefused() {
        for (String title : GATE_FAILURES) {
            Locator screen = page.locator("main :text-is('" + title + "')");
            if (screen.count() > 0 && screen.first().isVisible()) {
                throw new AssertionError("The remote-access approval gate ended on \"" + title
                        + "\", so the session never started.");
            }
        }
    }

    public boolean waitForDesktop() {
        page.waitForCondition(this::canvasIsNotBlank,
                new Page.WaitForConditionOptions().setTimeout(DESKTOP_PAINT_MS));
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
                url -> !url.contains("/remote-desktop"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        return new DeviceDetailsPage(page);
    }
}