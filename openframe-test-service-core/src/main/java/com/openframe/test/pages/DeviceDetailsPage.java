package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * Page Object for the Device Details page.
 * URL pattern: /devices/details/{id}/
 */
public class DeviceDetailsPage {

    private final Page page;

    // ── Selectors ────────────────────────────────────────────────────────────

    private static final String DEVICE_NAME_HEADING = "main h1";

    // Status badge: scoped to main, filtered to the span that carries the
    // status text (ONLINE / OFFLINE / ARCHIVED). The badge spans sit inside
    // the header area alongside the "Updated X ago" span; target the one whose
    // text is all-uppercase and short (≤10 chars) to avoid matching the
    // "Updated …" span that also has shrink-0.
    private static final String STATUS_BADGE =
            "main span:text-matches('^(ONLINE|OFFLINE|ARCHIVED)$')";

    // ── Constructor ──────────────────────────────────────────────────────────

    public DeviceDetailsPage(Page page) {
        this.page = page;
    }

    // ── Header accessors ─────────────────────────────────────────────────────

    /**
     * Returns the device name shown in the h1 heading (e.g. "VM114267").
     */
    public String getDeviceName() {
        return page.locator(DEVICE_NAME_HEADING).innerText().trim();
    }

    /**
     * Returns the connectivity status badge text (e.g. "ONLINE", "OFFLINE",
     * "ARCHIVED").
     */
    public String getDeviceStatus() {
        return page.locator(STATUS_BADGE).innerText().trim();
    }

    /**
     * Returns the "Updated X seconds" / "Updated just now" timestamp text
     * shown next to the status badge.
     */
    public String getLastUpdatedText() {
        return page.locator("main span.text-ods-text-secondary.text-xs").innerText().trim();
    }

    // ── Info card metadata ────────────────────────────────────────────────────

    /**
     * Returns the value for a given metadata field label in the info card.
     * Labels include: "Type", "Manufacturer", "Model", "Serial Number",
     * "Host Name", "Organization Name", "Last Seen", "Last Boot",
     * "Operating System", "Requires Reboot", "UUID", "MAC Address".
     *
     * @param label exact label text (e.g. "Operating System")
     * @return the value text (e.g. "Windows Windows Server 2025 …")
     */
    public String getInfoField(String label) {
        // Each cell is: <p class="text-ods-text-primary …">VALUE</p>
        //                <p class="text-ods-text-secondary …">LABEL</p>
        return page.locator("main p.text-ods-text-secondary")
                .filter(new Locator.FilterOptions().setHasText(label))
                .locator("xpath=preceding-sibling::p[1]")
                .innerText()
                .trim();
    }

    // ── Action bar ────────────────────────────────────────────────────────────

    /**
     * Clicks "Back to Devices".
     */
    public void clickBackToDevices() {
        page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Back to Devices")).click();
    }

    /**
     * Clicks "Remote Control" and waits for the URL to transition to the
     * remote-desktop sub-route.
     *
     * @return a new {@link RemoteDesktopPage} scoped to the same page
     */
    public RemoteDesktopPage openRemoteDesktop() {
        page.locator("main button[role='link']")
                .filter(new Locator.FilterOptions().setHasText("Remote Control"))
                .click();
        page.waitForURL(
                url -> url.contains("/remote-desktop/"),
                new Page.WaitForURLOptions().setTimeout(15_000));
        return new RemoteDesktopPage(page);
    }

    /**
     * Opens the Remote Shell dropdown and clicks the "CMD" option.
     * The Remote Shell button has {@code aria-haspopup="menu"}.
     */
    public void openRemoteShellCmd() {
        openRemoteShellMenu();
        clickMenuItemByText("CMD");
    }

    /**
     * Opens the Remote Shell dropdown and clicks the "PowerShell" option.
     */
    public void openRemoteShellPowerShell() {
        openRemoteShellMenu();
        clickMenuItemByText("PowerShell");
    }

    /**
     * Clicks "Manage Files" (navigates to the file manager sub-route).
     */
    public void clickManageFiles() {
        page.locator("main button[role='link']")
                .filter(new Locator.FilterOptions().setHasText("Manage Files"))
                .click();
    }

    // ── ⋯ More-actions menu ───────────────────────────────────────────────────

    /**
     * Opens the ⋯ more-actions menu and clicks "Run Script".
     */
    public void clickRunScript() {
        openMoreActionsMenu();
        clickMenuItemByText("Run Script");
    }

    /**
     * Opens the ⋯ more-actions menu and clicks "Uninstall Device".
     */
    public void clickUninstallDevice() {
        openMoreActionsMenu();
        clickMenuItemByText("Uninstall Device");
    }

    /**
     * Opens the ⋯ more-actions menu and clicks "Archive Device".
     */
    public void clickArchiveDevice() {
        openMoreActionsMenu();
        clickMenuItemByText("Archive Device");
    }

    /**
     * Opens the ⋯ more-actions menu and clicks "Delete Device".
     */
    public void clickDeleteDevice() {
        openMoreActionsMenu();
        clickMenuItemByText("Delete Device");
    }

    // ── Tab bar ───────────────────────────────────────────────────────────────

    /**
     * Clicks the tab with the given name.
     * Valid names: "Hardware", "Network", "Security", "Compliance",
     * "Agents", "Users", "Software", "Vulnerabilities", "Logs".
     *
     * @param tabName exact tab label text
     */
    public void clickTab(String tabName) {
        page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName(tabName)).click();
    }

    /**
     * Returns {@code true} if the given tab is currently active.
     * Active tabs carry a {@code bg-gradient-to-b} class on their button.
     *
     * @param tabName exact tab label text
     */
    public boolean isTabActive(String tabName) {
        String cls = page.getByRole(AriaRole.BUTTON,
                        new Page.GetByRoleOptions().setName(tabName))
                .getAttribute("class");
        return cls != null && cls.contains("bg-gradient-to-b");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Clicks the Remote Shell split-button to open its dropdown.
     */
    private void openRemoteShellMenu() {
        // The split button has aria-haspopup=menu and visible text "Remote Shell"
        page.locator("main button[aria-haspopup='menu']")
                .filter(new Locator.FilterOptions().setHasText("Remote Shell"))
                .click();
        page.locator("[role='menu']").waitFor();
    }

    /**
     * Clicks the ⋯ icon button to open the more-actions dropdown.
     */
    private void openMoreActionsMenu() {
        // The ⋯ button has aria-haspopup=menu and no visible text
        page.locator("main button[type='button'][aria-haspopup='menu']")
                .filter(new Locator.FilterOptions().setHasNotText("Remote Shell"))
                .click();
        page.locator("[role='menu']").waitFor();
    }

    /**
     * Clicks an item inside the currently open {@code [role="menu"]} by its
     * visible text. Menu items are plain {@code <div onclick>} elements with
     * no semantic role, so we match by text content.
     */
    private void clickMenuItemByText(String text) {
        page.locator("[role='menu'] div")
                .filter(new Locator.FilterOptions().setHasText(text))
                // Use last() to pick the innermost div that contains only that text,
                // not a wrapper that contains all items
                .last()
                .click();
    }
}