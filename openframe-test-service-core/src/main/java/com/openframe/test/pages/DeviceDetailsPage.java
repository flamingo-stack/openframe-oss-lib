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

    // The status badge is an ODS `Tag` (openframe-frontend-core src/components/ui/tag.tsx). Match the
    // pill's own container and take the first one in <main>: the status badge precedes all tab content.
    //
    // Everything about this header's *layout* drifts, so do not anchor on it. Three attempts have now
    // broken here, each for a different reason:
    //
    //   1. Sibling-of-h1 ("main h1 + span span.truncate") — `TitleBlock` wraps the <h1> in
    //      FloatingTooltip's own <div ref=setReference>, so the <h1> has no element sibling at all.
    //   2. Scoped to a "div.flex.items-center.flex-wrap.py-4" status row — that div no longer exists.
    //   3. A `>` child combinator between the pill and its text span — Tag now nests the text one level
    //      deeper, and a direct-child match silently returns nothing.
    //
    // (3) is the current shape, verified against a captured failure DOM:
    //   <div class="inline-flex items-center justify-center rounded-md …">
    //     <span class="min-w-0 max-w-full">
    //       <span class="truncate block">ONLINE</span>   <-- was a direct child, now a grandchild
    //
    // Hence a descendant combinator, and no layout scope. The only structural assumption left is the
    // Tag container's own utility classes, which come from the component rather than from this page.
    // Measured on that DOM: this matches the ONLINE badge first, the log row's INFO pill second.
    private static final String STATUS_PILL =
            "div.inline-flex.items-center.justify-center.rounded-md span.truncate";
    private static final String STATUS_BADGE_ANY = "main " + STATUS_PILL;

    // Radix `DropdownMenuContent` — a DIV with role="menu", portalled to the
    // document body when open (and unmounted when closed, so at most one exists).
    //
    // The DIV qualifier is load-bearing: the app shell also mounts a media-chrome
    // video player (the walkthrough video), whose <media-rendition-menu>,
    // <media-playback-rate-menu>, <media-audio-track-menu> and
    // <media-captions-menu> custom elements each carry role="menu" permanently.
    // A bare "[role='menu']" therefore resolves to 5 elements and every strict
    // locator call on it fails — regardless of which page or menu is open.
    private static final String MENU = "div[role='menu']";

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
     */
    public String getDeviceStatus() {
        Locator badge = resolvedStatusBadge();
        if (badge == null) {
            // Nothing rendered yet — wait on the widest form so a genuinely slow
            // header still passes, and a real DOM change fails with the selector
            // named in the Playwright call log.
            badge = page.locator(STATUS_BADGE_ANY).first();
            badge.waitFor(new Locator.WaitForOptions().setTimeout(15_000));
        }
        return badge.innerText().trim();
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

    /**
     * Same condition as before — device name and status badge both present and
     * non-empty — but evaluated without ever blocking.
     * <p>
     * This is polled by {@link Page#waitForCondition}, so it must not call the
     * auto-waiting accessors: a selector that matches nothing turns one poll
     * into a 30s {@code innerText()} timeout that surfaces as a Playwright
     * error from inside the wait instead of the wait simply not being satisfied.
     * {@code count()} does not wait, and once it is non-zero the element exists,
     * so {@code innerText()} on it returns immediately.
     */
    public boolean isLoaded() {
        Locator name = page.locator(DEVICE_NAME_HEADING).first();
        if (name.count() == 0 || name.innerText().trim().isEmpty()) {
            return false;
        }
        Locator badge = resolvedStatusBadge();
        return badge != null && !badge.innerText().trim().isEmpty();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Returns the status-badge locator if it currently resolves to an element, or {@code null}.
     * Never waits — callers decide whether a miss means "not loaded yet" or "wait for it".
     */
    private Locator resolvedStatusBadge() {
        Locator candidate = page.locator(STATUS_BADGE_ANY).first();
        return candidate.count() > 0 ? candidate : null;
    }

    /**
     * Clicks the Remote Shell split-button to open its dropdown.
     * The whole split-button group carries {@code aria-haspopup="menu"}.
     */
    private void openRemoteShellMenu() {
        page.locator("main button[aria-haspopup='menu']")
                .filter(new Locator.FilterOptions().setHasText("Remote Shell"))
                .click();
        page.locator(MENU).waitFor();
    }

    /**
     * Clicks the ⋯ icon button (aria-label="More actions") to open the
     * more-actions dropdown.
     */
    private void openMoreActionsMenu() {
        page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("More actions")).click();
        page.locator(MENU).waitFor();
    }

    /**
     * Clicks an item inside the currently open {@link #MENU} by its visible text.
     */
    private void clickMenuItemByText(String text) {
        page.locator(MENU + " a, " + MENU + " [role='menuitem']")
                .filter(new Locator.FilterOptions().setHasText(text))
                .last()
                .click();
    }
}