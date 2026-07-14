package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.TimeoutError;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitForSelectorState;

/**
 * Page Object for the Devices list page.
 * URL: /devices/
 *
 * <p>Layout (table view – default):
 * <pre>
 * ┌─ Heading "Devices"  (H1)
 * ├─ View toggle  [Table active] [Grid inactive]
 * ├─ Add Device button
 * ├─ Search bar  "Search for Devices"
 * ├─ Filter Tags button  →  "Sort and Filter" modal dialog
 * ├─ Column header row  DEVICE | STATUS | OS | ORGANIZATION | "N results"
 * └─ Device rows  (cursor-pointer cards)
 *    └─ per row:  device icon | name | status+date | OS | org | ⋮ context menu | ↗ open-in-new-tab link
 * </pre>
 */
public class DevicesPage {

    public static final String URL_FRAGMENT = "/devices";

    private final Page page;

    // ── Page heading ─────────────────────────────────────────────────────────
    // The heading is an <h1> (not h2) with class text-h2 text-ods-text-primary.
    private static final String PAGE_HEADING = "main h1";

    // ── View-toggle buttons ──────────────────────────────────────────────────
    // The two toggle buttons are plain <button type="button"> elements with no
    // role="radio", no aria-label, and no aria-checked attributes.
    // Active state:   bg-ods-accent + cursor-default  (table view is default active)
    // Inactive state: bg-transparent + cursor-pointer
    // They live inside: div.flex.w-full.bg-ods-bg.border.border-ods-border.rounded-md.p-1
    // and are the only two buttons in that container, so we use :nth-child().
    private static final String VIEW_TOGGLE_CONTAINER =
            "main div.flex.w-full.bg-ods-bg.border.border-ods-border.rounded-md";
    private static final String TABLE_VIEW_BTN = VIEW_TOGGLE_CONTAINER + " button:nth-child(1)";
    private static final String GRID_VIEW_BTN = VIEW_TOGGLE_CONTAINER + " button:nth-child(2)";

    // ── Add Device button ────────────────────────────────────────────────────
    // Two submit buttons exist: one with visible text (desktop), one icon-only
    // (aria-label="Add Device", hidden on desktop). Target the text variant.
    private static final String ADD_DEVICE_BTN = "main button:has-text('Add Device'):visible";

    // ── Search input ─────────────────────────────────────────────────────────
    private static final String SEARCH_INPUT = "input[placeholder='Search for Devices']";

    // ── Device Tags button ───────────────────────────────────────────────────
    // Opens the "Sort and Filter" panel. Label is "Device Tags" (renamed from the
    // former "Filter Tags"); there is no aria-label attribute on this button.
    private static final String OPEN_FILTERS_BTN = "main button:has-text('Device Tags')";

    // ── Results counter ──────────────────────────────────────────────────────
    // Text format is "N results" (no "Showing" prefix).
    // Element: <span class="text-h6 text-ods-text-secondary whitespace-nowrap">
    private static final String RESULTS_COUNT =
            "main span.text-h6.text-ods-text-secondary:text-matches('^\\d+ results$')";

    // ── Device row cards ─────────────────────────────────────────────────────
    // Each row IS the detail link – an <a> that wraps the whole card:
    //   <a class="block rounded-md bg-ods-card ... cursor-pointer" href="/devices/details?id={id}">
    //     (device name span, status badge, last-seen, and the "More actions" button)
    // Matched by its stable href rather than churn-prone Tailwind utility classes.
    // Note: the detail URL is query-param based (/devices/details?id=…), so the
    // match deliberately stops at "/devices/details" (no trailing slash).
    private static final String DEVICE_ROW =
            "main a[href*='/devices/details']";

    // Status badge: <span class="truncate"> (values: "ONLINE", "OFFLINE", "ARCHIVED")
    private static final String ROW_STATUS = "span.truncate";

    // Last-seen timestamp: <span class="text-h6 text-ods-text-secondary hidden md:flex">
    private static final String ROW_LAST_SEEN =
            "span.text-h6.text-ods-text-secondary.hidden";

    // Three-dot context menu trigger: button[aria-haspopup="menu"][aria-label="More actions"]
    // aria-expanded="false"|"true" and data-state="closed"|"open" are set while menu is open.
    private static final String ROW_MENU_BTN =
            "button[aria-haspopup='menu'][aria-label='More actions']";

    // ── Sort and Filter modal ────────────────────────────────────────────────
    // The modal is: div[role="dialog"][aria-modal="true"]
    // It is appended to <main> when open and removed (or hidden) when closed.
    private static final String FILTER_PANEL =
            "div[role='dialog'][aria-modal='true']:not([aria-label])";

    private static final String FILTER_RESET_BTN =
            FILTER_PANEL + " button:has-text('Reset Filters')";
    private static final String FILTER_APPLY_BTN =
            FILTER_PANEL + " button:has-text('Apply Filters')";

    // ── Filter panel: tag key checkboxes ─────────────────────────────────────
    // Structure inside the panel:
    //
    //   div.flex.flex-col.gap-4               ← all groups
    //     div.flex.flex-col.gap-2             ← "Tag Keys" group
    //       span.text-h5.uppercase            "Tag Keys"
    //       div.rounded-[6px].border          ← bordered list of key rows
    //         div.flex.items-center           ← one key row
    //           button[role="checkbox"]       key checkbox
    //           span.flex-1                   key name text (e.g. "new_tag")
    //
    //     div.flex.flex-col.gap-2             ← value group (only when key is checked)
    //       span.text-h5.uppercase            key name (e.g. "new_tag") — exact lowercase
    //       div.rounded-[6px].border          ← bordered list of value rows
    //         div.flex.items-center           ← one value row
    //           button[role="checkbox"]       value checkbox
    //           span.flex-1                   value name text
    //           span.shrink-0                 device count badge
    //
    // Key-checkbox selector: scoped to the "Tag Keys" group header so it never
    // accidentally matches a same-named value section header.
    private static final String FILTER_TAG_KEY_CHECKBOX_BY_NAME =
            FILTER_PANEL
                    + " div.flex.flex-col.gap-2:has(> span:text-is('Tag Keys'))"
                    + " div.flex.items-center:has(> span.flex-1:text-is('%s'))"
                    + " button[role='checkbox']";

    // Value-section container: scoped to the group whose header text equals the key name.
    // The "Tag Keys" header text is "Tag Keys" (title-cased), while value-group headers
    // use the raw lowercase key name (e.g. "new_tag"), so :text-is() is unambiguous.
    private static final String FILTER_TAG_VALUE_SECTION_BY_KEY =
            FILTER_PANEL
                    + " div.flex.flex-col.gap-2:has(> span.text-h5:text-is('%s'))";

    // Value-checkbox selector: inside the correct key's value section.
    private static final String FILTER_TAG_VALUE_CHECKBOX_BY_NAME =
            FILTER_TAG_VALUE_SECTION_BY_KEY
                    + " div.flex.items-center:has(> span.flex-1:text-is('%s'))"
                    + " button[role='checkbox']";

    // ── Context menu ─────────────────────────────────────────────────────────
    // The Radix [role="menu"] floats in a portal. Items are wrapped in
    //   div.relative.flex.items-stretch  (one per visible row + one empty separator)
    // "Remote Shell" and "Run Script" expose role="menuitem" on a DIV (sub-menu trigger
    // and click-action respectively). "Remote Control" and "Manage Files" are <a> links
    // with no role="menuitem". "Archive Device" and "Delete Device" are DIV[role="menuitem"].
    // There is NO "Uninstall Device" item in the current UI.
    // All items share span.flex-1 as their visible label node.
    private static final String CTX_MENU = "[role='menu']";

    // Generic item selector that works for both DIV[role=menuitem] and <a> link items:
    // match any direct child of the menu container that contains a span.flex-1 with the text.
    private static final String CTX_ITEM_BY_TEXT =
            CTX_MENU + " :is(div[role='menuitem'], a):has(span.flex-1:text-is('%s'))";

    // ── Additional selectors needed by the filter-chip tests ─────────────────────

    // The active filter chip rendered in the search bar after a filter is applied.
// Text format: "key:value"  e.g. "purpose:auto_test"
// Element: span.truncate.max-w-[120px]  inside the chip container.
// There can be two copies of the same span (one is an invisible measurement
// clone); .first() is safe because both are equivalent and the visible one
// comes first.
    private static final String ACTIVE_FILTER_CHIP_BY_TEXT =
            "main span.truncate:text-is('%s')";

    // "Clear all" button — removes every active filter chip at once.
    private static final String CLEAR_ALL_FILTERS_BTN =
            "main button[aria-label='Clear all']";

    // ── Constructor ──────────────────────────────────────────────────────────
    public DevicesPage(Page page) {
        this.page = page;
    }

    // ── Page-level locators ──────────────────────────────────────────────────

    public Locator pageHeading() {
        return page.locator(PAGE_HEADING);
    }

    /**
     * The Table-view toggle button (first in the container; active by default).
     */
    public Locator tableViewButton() {
        return page.locator(TABLE_VIEW_BTN);
    }

    /**
     * The Grid-view toggle button (second in the container).
     */
    public Locator gridViewButton() {
        return page.locator(GRID_VIEW_BTN);
    }

    public Locator addDeviceButton() {
        return page.locator(ADD_DEVICE_BTN);
    }

    public Locator searchInput() {
        return page.locator(SEARCH_INPUT);
    }

    public Locator openFiltersButton() {
        return page.locator(OPEN_FILTERS_BTN);
    }

    /**
     * Span showing "N results" in the column header row.
     */
    public Locator resultsCount() {
        return page.locator(RESULTS_COUNT);
    }

    /**
     * All device-row cards currently rendered.
     */
    public Locator deviceRows() {
        return page.locator(DEVICE_ROW);
    }

    /**
     * First device-row card whose visible text contains {@code name}.
     */
    public Locator deviceRowByName(String name) {
        return page.locator(DEVICE_ROW + ":has-text('" + name + "')").first();
    }

    /**
     * The three-dot "More actions" button inside the named device row.
     */
    public Locator rowMenuButtonByName(String deviceName) {
        return deviceRowByName(deviceName).locator(ROW_MENU_BTN).first();
    }

    // ── Filter panel locators ────────────────────────────────────────────────

    public Locator filterPanel() {
        return page.locator(FILTER_PANEL);
    }

    public Locator filterResetButton() {
        return page.locator(FILTER_RESET_BTN);
    }

    public Locator filterApplyButton() {
        return page.locator(FILTER_APPLY_BTN);
    }

    /**
     * The checkbox for a tag key in the "Tag Keys" section.
     *
     * @param tagKey exact key name as shown in the UI, e.g. {@code "new_tag"}
     */
    public Locator filterTagKeyCheckbox(String tagKey) {
        return page.locator(String.format(FILTER_TAG_KEY_CHECKBOX_BY_NAME, tagKey));
    }

    // ── Additional locators ───────────────────────────────────────────────────────

    /**
     * The active filter chip in the search bar whose text equals {@code chipText}.
     * Text format: {@code "key:value"}, e.g. {@code "purpose:auto_test"}.
     *
     * @param chipText the exact chip label (key + ":" + value, lowercase)
     */
    public Locator activeFilterChip(String chipText) {
        return page.locator(String.format(ACTIVE_FILTER_CHIP_BY_TEXT, chipText)).first();
    }

// ── Additional actions ────────────────────────────────────────────────────────

    /**
     * Clicks the "Clear all" button in the search bar to remove all active filter
     * chips and waits for the result list to settle.
     *
     * <p>Only available when at least one filter chip is active (i.e. the button
     * is visible). Safe to call after {@link #filterByTag}.
     *
     * @return this page object for fluent chaining
     */
    public DevicesPage clearAllFilters() {
        page.locator(CLEAR_ALL_FILTERS_BTN).click();
        page.waitForLoadState(LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * The container for a tag key's value list.
     * Only present in the DOM once the corresponding key checkbox is checked.
     *
     * @param tagKey exact key name, e.g. {@code "new_tag"}
     */
    public Locator filterTagValueSection(String tagKey) {
        return page.locator(String.format(FILTER_TAG_VALUE_SECTION_BY_KEY, tagKey));
    }

    /**
     * The checkbox for a specific value inside a tag key's value section.
     *
     * @param tagKey   exact key name, e.g. {@code "new_tag"}
     * @param tagValue exact value name, e.g. {@code "windows"}
     */
    public Locator filterTagValueCheckbox(String tagKey, String tagValue) {
        return page.locator(String.format(FILTER_TAG_VALUE_CHECKBOX_BY_NAME, tagKey, tagValue));
    }

    // ── Context-menu locators ────────────────────────────────────────────────

    public Locator contextMenu() {
        return page.locator(CTX_MENU);
    }

    /**
     * "Remote Shell" — DIV[role=menuitem] with a submenu arrow.
     */
    public Locator ctxRemoteShellItem() {
        return page.locator(String.format(CTX_ITEM_BY_TEXT, "Remote Shell"));
    }

    /**
     * "Remote Control" — rendered as an {@code <a>} link to {@code /remote-desktop/}.
     */
    public Locator ctxRemoteControlItem() {
        return page.locator(String.format(CTX_ITEM_BY_TEXT, "Remote Control"));
    }

    /**
     * "Manage Files" — rendered as an {@code <a>} link to {@code /file-manager/}.
     */
    public Locator ctxManageFilesItem() {
        return page.locator(String.format(CTX_ITEM_BY_TEXT, "Manage Files"));
    }

    /**
     * "Run Script" — DIV[role=menuitem].
     */
    public Locator ctxRunScriptItem() {
        return page.locator(String.format(CTX_ITEM_BY_TEXT, "Run Script"));
    }

    /**
     * "Archive Device" — DIV[role=menuitem].
     */
    public Locator ctxArchiveItem() {
        return page.locator(String.format(CTX_ITEM_BY_TEXT, "Archive Device"));
    }

    /**
     * "Delete Device" — DIV[role=menuitem].
     */
    public Locator ctxDeleteItem() {
        return page.locator(String.format(CTX_ITEM_BY_TEXT, "Delete Device"));
    }

    // ── Derived helpers ───────────────────────────────────────────────────────

    public String getPageHeading() {
        return pageHeading().innerText().trim();
    }

    /**
     * Parses "N results" → N.
     */
    public int getResultsCount() {
        String text = resultsCount().innerText().trim();
        return Integer.parseInt(text.replaceAll("\\D+", ""));
    }

    /**
     * Returns true when the Table-view button is the active toggle.
     * Active state is indicated by the {@code bg-ods-accent} Tailwind class.
     */
    public boolean isTableViewActive() {
        String cls = tableViewButton().getAttribute("class");
        return cls != null && cls.contains("bg-ods-accent");
    }

    /**
     * Returns true when the Grid-view button is the active toggle.
     */
    public boolean isGridViewActive() {
        String cls = gridViewButton().getAttribute("class");
        return cls != null && cls.contains("bg-ods-accent");
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    /**
     * Types into the search bar and waits for network activity to settle.
     */
    public DevicesPage searchFor(String query) {
        searchInput().fill(query);
        page.waitForLoadState(LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Clears the search bar and waits for network activity to settle.
     */
    public DevicesPage clearSearch() {
        searchInput().clear();
        page.waitForLoadState(LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Switches to Grid view.
     */
    public DevicesPage switchToGridView() {
        gridViewButton().click();
        return this;
    }

    /**
     * Switches to Table view.
     */
    public DevicesPage switchToTableView() {
        tableViewButton().click();
        return this;
    }

    /**
     * Clicks "Filter Tags" and waits for the modal to become visible.
     */
    public DevicesPage openFilterPanel() {
        openFiltersButton().click();
        filterPanel().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(5_000));
        return this;
    }

    /**
     * Clicks "Apply Filters", waits for the modal to close, then for NETWORKIDLE.
     */
    public DevicesPage applyFilters() {
        filterApplyButton().click();
        filterPanel().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.HIDDEN)
                .setTimeout(5_000));
        page.waitForLoadState(LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Clicks "Reset Filters" inside the open panel (panel remains open).
     */
    public DevicesPage resetFilters() {
        filterResetButton().click();
        return this;
    }

    /**
     * Opens the filter panel, checks the given tag key (if not already checked)
     * so that its value list expands, then checks the given tag value, and applies
     * the filter.
     *
     * <p>Multiple calls can be chained to build a multi-value selection before
     * {@link #applyFilters()} — in that case call {@link #openFilterPanel()} once,
     * use {@link #filterTagKeyCheckbox} / {@link #filterTagValueCheckbox} directly,
     * and call {@link #applyFilters()} at the end.
     *
     * @param tagKey   exact key name as shown in the UI (e.g. {@code "new_tag"})
     * @param tagValue exact value name as shown in the UI (e.g. {@code "windows"})
     * @return this page object for fluent chaining
     */
    public DevicesPage filterByTag(String tagKey, String tagValue) {
        openFilterPanel();

        // Expand the value list for this key if it is not yet checked.
        Locator keyCheckbox = filterTagKeyCheckbox(tagKey);
        if (!"true".equals(keyCheckbox.getAttribute("aria-checked"))) {
            keyCheckbox.click();
            filterTagValueSection(tagKey).waitFor(new Locator.WaitForOptions()
                    .setState(WaitForSelectorState.VISIBLE)
                    .setTimeout(5_000));
        }

        filterTagValueCheckbox(tagKey, tagValue).click();
        return applyFilters();
    }

    /**
     * Opens the three-dot context menu on the named device row and waits for
     * it to become visible.
     */
    public DevicesPage openContextMenuFor(String deviceName) {
        rowMenuButtonByName(deviceName).click();
        contextMenu().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(5_000));
        return this;
    }

    /**
     * Clicks "Remote Control" in the currently open context menu.
     * "Remote Control" is an {@code <a>} link; clicking it navigates to
     * {@code /devices/details/{id}/remote-desktop/}.
     *
     * @return the resulting {@link RemoteDesktopPage}
     */
    public RemoteDesktopPage clickRemoteControlInMenu() {
        ctxRemoteControlItem().click();
        page.waitForURL(
                url -> url.contains("/remote-desktop"),
                new Page.WaitForURLOptions().setTimeout(15_000));
        return new RemoteDesktopPage(page);
    }

    /**
     * Clicks a device row by name and waits for the detail page to load.
     *
     * @return the resulting {@link DeviceDetailsPage}
     */
    public DeviceDetailsPage openDevice(String deviceName) {
        // The list can hold many devices (and only renders a subset at a time),
        // so narrow it down via the search box before clicking the row.
        searchInput().fill(deviceName);
        // Let the filtered result set finish rendering before interacting, so
        // the click lands on the settled row and not a node about to be
        // replaced (which would swallow the SPA navigation).
        page.waitForLoadState(LoadState.NETWORKIDLE);
        Locator row = deviceRowByName(deviceName);
        row.waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(15_000));
        row.click();
        try {
            page.waitForURL(
                    url -> url.contains("/devices/details"),
                    new Page.WaitForURLOptions().setTimeout(12_000));
        } catch (TimeoutError firstClickMissed) {
            // Occasionally the first click does not trigger SPA navigation
            // (row re-rendered under the cursor); click the settled row again.
            row.click();
            page.waitForURL(
                    url -> url.contains("/devices/details"),
                    new Page.WaitForURLOptions().setTimeout(12_000));
        }
        DeviceDetailsPage deviceDetailsPage = new DeviceDetailsPage(page);
        page.waitForCondition(deviceDetailsPage::isLoaded);
        return deviceDetailsPage;
    }

    /**
     * Returns true when the page is fully loaded:
     * the URL contains {@value #URL_FRAGMENT} and the visible "Add Device"
     * button is present.
     */
    public boolean isLoaded() {
        return page.url().contains(URL_FRAGMENT) && addDeviceButton().isVisible();
    }
}