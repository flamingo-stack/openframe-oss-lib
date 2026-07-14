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

    // FIX: the ODS header was refactored. The status badge is now a pill
    // <div class="... inline-flex items-center justify-center ...">
    //   <span class="truncate" title="ONLINE">ONLINE</span>
    // </div>
    // rendered inside a <span class="shrink-0"> that is the immediate sibling
    // of the device-name <h1>. The previous selector
    // "main div.flex.gap-2.items-center span.truncate" no longer matched the
    // badge — that class combo now belongs to the action-buttons row (Remote
    // Control / Remote Shell), which has no truncate span, so getDeviceStatus()
    // timed out. Anchor to the h1 instead so the selector is stable across
    // ONLINE/OFFLINE/ARCHIVED (only the inner div's bg colour changes).
    private static final String STATUS_BADGE =
            "main h1 + span span.truncate";

    // ── Constructor ──────────────────────────────────────────────────────────

    public DeviceDetailsPage(Page page) {
        this.page = page;
    }

    // ── Header accessors ─────────────────────────────────────────────────────

    /**
     * Returns the device name shown in the h1 heading (e.g. "VM115982").
     */
    public String getDeviceName() {
        return page.locator(DEVICE_NAME_HEADING).innerText().trim();
    }

    /**
     * Returns the connectivity status badge text (e.g. "ONLINE", "OFFLINE",
     * "ARCHIVED").
     * <p>
     * FIX: The badge is a {@code <div>} whose only text child is a
     * {@code <span class="truncate">}. The original selector targeted
     * {@code span:text-matches(...)} which never matched the div wrapper.
     */
    public String getDeviceStatus() {
        return page.locator(STATUS_BADGE).first().innerText().trim();
    }

    /**
     * Returns the "Updated X seconds" / "Updated just now" timestamp text
     * shown next to the status badge.
     * <p>
     * NOTE: This text is not present on the current live page. The selector
     * is retained but guarded — returns an empty string rather than throwing
     * if the element is absent.
     */
    public String getLastUpdatedText() {
        Locator loc = page.locator("main span.text-ods-text-secondary.text-xs");
        return loc.count() > 0 ? loc.first().innerText().trim() : "";
    }

    // ── Info card metadata ────────────────────────────────────────────────────

    /**
     * Returns the value for a given metadata field label in the info card.
     * Labels include: "Hostname", "Type", "Device", "Serial Number",
     * "Customer ID (Site)", "Registered", "Updated", "UUID".
     * <p>
     * FIX: The DOM structure is:
     * <pre>
     *   div.flex.flex-col.justify-center   (field cell)
     *     div > p.text-ods-text-primary    (value)
     *     p.text-ods-text-secondary        (label — BELOW the value)
     * </pre>
     * The original XPath {@code preceding-sibling::p[1]} assumed the label
     * came after the value in sibling order but traversed the wrong axis.
     * Now we filter the cell div by the label text, then grab the first
     * {@code p.text-ods-text-primary} child as the value.
     *
     * @param label exact label text (e.g. "Hostname")
     * @return the value text (e.g. "vm115982")
     */
    public String getInfoField(String label) {
        return page.locator("main p.text-ods-text-secondary.text-h6")
                .filter(new Locator.FilterOptions().setHasText(label))
                .locator("xpath=../div/p[@class[contains(.,'text-ods-text-primary')]]")
                .first()
                .innerText()
                .trim();
    }

    // ── Action bar ────────────────────────────────────────────────────────────

    /**
     * Clicks the "Back" button (top-left of the detail page).
     * <p>
     * FIX: The button label on the live page is "Back", not "Back to Devices".
     * Using a CSS class anchor instead of text to avoid locale/copy drift.
     */
    public void clickBackToDevices() {
        page.locator("main button.hidden.md\\:inline-flex").first().click();
    }

    /**
     * Clicks the Remote Control link in the action bar and waits for
     * the URL to transition to the remote-desktop sub-route.
     *
     * @return a new {@link RemoteDesktopPage} scoped to the same page
     */
    public RemoteDesktopPage openRemoteDesktop() {
        // href is query-param based (/devices/details/remote-desktop?id=…), so
        // match on "contains" rather than "ends-with".
        page.locator("main a[href*='/remote-desktop']").first().click();
        page.waitForURL(
                url -> url.contains("/remote-desktop"),
                new Page.WaitForURLOptions().setTimeout(15_000));
        return new RemoteDesktopPage(page).waitForCanvasVisible(15_000);
    }

    /**
     * Opens the ⋯ more-actions menu, clicks "Manage Files", and waits for
     * the File Manager page to finish loading.
     *
     * @return a new {@link FileManagerPage} scoped to the same page
     */
    public FileManagerPage openFileManager() {
        openMoreActionsMenu();
        clickMenuItemByText("Manage Files");
        FileManagerPage fileManagerPage = new FileManagerPage(this.page);
        page.waitForCondition(fileManagerPage::isLoaded);
        return fileManagerPage;
    }

    /**
     * Opens the Remote Shell dropdown and clicks the "CMD" option.
     */
    public void openRemoteShellCmd() {
        openRemoteShellMenu();
        clickMenuItemByText("CMD");
    }

    /**
     * Opens the Remote Shell dropdown and clicks the "PowerShell" option.
     *
     * @return a new {@link RemoteShellPage} scoped to the same page
     */
    public RemoteShellPage openRemoteShellPowerShell() {
        openRemoteShellMenu();
        clickMenuItemByText("PowerShell");
        RemoteShellPage remoteShellPage = new RemoteShellPage(this.page);
        remoteShellPage.waitForOutputContaining("PS ", 30_000);
        return remoteShellPage;
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
     * Active tabs carry a {@code bg-gradient-to-b} class directly on the
     * button (inactive tabs only have it under a {@code hover:} prefix).
     *
     * @param tabName exact tab label text
     */
    public boolean isTabActive(String tabName) {
        String cls = page.getByRole(AriaRole.BUTTON,
                        new Page.GetByRoleOptions().setName(tabName))
                .getAttribute("class");
        // Active:   "... bg-gradient-to-b from-..."
        // Inactive: "... hover:bg-gradient-to-b hover:from-..."
        return cls != null
                && cls.contains("bg-gradient-to-b")
                && !cls.contains("hover:bg-gradient-to-b");
    }

    // ── Agents tab ────────────────────────────────────────────────────────────

    /**
     * Returns the status text for a given agent by its card heading name.
     * Requires the Agents tab to be active; call {@link #clickTab(String)}
     * with {@code "Agents"} first if needed.
     * <p>
     * Valid agent names: "Fleet", "MeshCentral",
     * "OpenFrame Client", "Osquery", "OpenFrame Chat".
     * <p>
     * FIX: the Agents tab was flattened in the ODS refactor. The card wrapper
     * no longer carries {@code relative} (and there is no nested
     * {@code div.bg-ods-card} body), so both halves of the old selector matched
     * nothing and innerText() timed out. Current DOM:
     * <pre>
     *   div.bg-ods-card.overflow-hidden.flex.flex-col   (agent card wrapper)
     *     span.text-ods-text-primary.text-h4            → agent name
     *     div (row) > span.text-h4 "Status"
     *       div.inline-flex.items-center.justify-center (status pill)
     *         span.truncate                             → ONLINE / OFFLINE
     * </pre>
     * The status value is the only pill in the card (ID/Version/Updated values
     * are plain spans), so target the pill's truncate span.
     *
     * @param agentName exact agent card heading text (e.g. "MeshCentral")
     * @return the status text (e.g. "ONLINE", "OFFLINE")
     */
    public String getAgentStatus(String agentName) {
        return page.locator("main div.bg-ods-card.overflow-hidden.flex.flex-col")
                .filter(new Locator.FilterOptions().setHasText(agentName))
                .locator("div.inline-flex.items-center.justify-center span.truncate")
                .first()
                .innerText()
                .trim();
    }

    // ── Loaded check ──────────────────────────────────────────────────────────

    public boolean isLoaded() {
        return !getDeviceName().isEmpty() && !getDeviceStatus().isEmpty();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Clicks the Remote Shell split-button to open its dropdown.
     * The whole split-button group carries {@code aria-haspopup="menu"}.
     */
    private void openRemoteShellMenu() {
        page.locator("main button[aria-haspopup='menu']")
                .filter(new Locator.FilterOptions().setHasText("Remote Shell"))
                .click();
        page.locator("[role='menu']").waitFor();
    }

    /**
     * Clicks the ⋯ icon button (aria-label="More actions") to open the
     * more-actions dropdown.
     */
    private void openMoreActionsMenu() {
        page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("More actions")).click();
        page.locator("[role='menu']").waitFor();
    }

    /**
     * Clicks an item inside the currently open {@code [role="menu"]} by its
     * visible text.
     */
    private void clickMenuItemByText(String text) {
        page.locator("[role='menu'] a, [role='menu'] [role='menuitem']")
                .filter(new Locator.FilterOptions().setHasText(text))
                .last()
                .click();
    }
}