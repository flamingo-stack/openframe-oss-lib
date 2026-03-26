package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Page Object for the Device Details page.
 * URL pattern: /devices/details/{deviceId}/
 * <p>
 * Assumption: the test arrives on this page already authenticated
 * (login + navigation are out of scope per requirements).
 */
public class DeviceDetailsPage {

    private final Page page;

    // ── Selectors ────────────────────────────────────────────────────────────
    // Device name is rendered in an <h1> inside <main>
    private static final String DEVICE_NAME_HEADING = "main h1";

    // Status badge: a <span> containing the text "ONLINE" / "OFFLINE"
    private static final String STATUS_BADGE = "main span.shrink-0";

    // "Remote Control" is a <button role="link"> — target by accessible text
    private static final String REMOTE_CONTROL_BTN = "main button[role='link']:has-text('Remote Control')";

    // ── Constructor ──────────────────────────────────────────────────────────
    public DeviceDetailsPage(Page page) {
        this.page = page;
    }

    // ── Accessors ────────────────────────────────────────────────────────────

    public Locator deviceNameHeading() {
        return page.locator(DEVICE_NAME_HEADING);
    }

    public Locator statusBadge() {
        return page.locator(STATUS_BADGE);
    }

    public Locator remoteControlButton() {
        return page.locator(REMOTE_CONTROL_BTN);
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    /**
     * Returns the device name as shown in the page heading (e.g. "VM114267").
     */
    public String getDeviceName() {
        return deviceNameHeading().innerText().trim();
    }

    /**
     * Returns the current connectivity status text (e.g. "ONLINE", "OFFLINE").
     */
    public String getDeviceStatus() {
        return statusBadge().innerText().trim();
    }

    /**
     * Clicks the "Remote Control" button and waits for navigation
     * to the remote-desktop sub-route.
     *
     * @return a new {@link RemoteDesktopPage} instance
     */
    public RemoteDesktopPage openRemoteDesktop() {
        page.waitForURL(
                url -> !url.contains("/remote-desktop/"),
                new Page.WaitForURLOptions().setTimeout(5_000)
        );

        remoteControlButton().click();

        // Wait for URL to transition to the remote-desktop sub-route
        page.waitForURL(
                url -> url.contains("/remote-desktop/"),
                new Page.WaitForURLOptions().setTimeout(15_000)
        );

        return new RemoteDesktopPage(page);
    }
}