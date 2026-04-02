package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;

/**
 * Page Object for the Devices list page.
 * URL: /devices/
 * <p>
 * Layout (table view – default):
 * ┌─ Heading "Devices"
 * ├─ View toggle  [Grid] [Table]
 * ├─ Add Device button
 * ├─ Search bar  "Search for Devices"
 * ├─ Open Filters button  →  "Sort and Filter" slide-up panel
 * ├─ Column header row  STATUS | OS | ORGANIZATION | "Showing N results"
 * └─ Device rows  (cursor-pointer cards)
 * └─ per row:  device icon | name | status+date | OS | org | ⋮ context menu
 */
public class DevicesPage {

    public static final String URL_FRAGMENT = "/devices/";

    private final Page page;

    // ── Selectors ────────────────────────────────────────────────────────────

    // Page heading
    private static final String PAGE_HEADING = "main h1, main h2";

    // View-toggle radio buttons (Radix ToggleGroup)
    private static final String GRID_VIEW_BTN = "button[role='radio'][aria-label='Grid view']";
    private static final String TABLE_VIEW_BTN = "button[role='radio'][aria-label='Table view']";

    // Add Device button
    private static final String ADD_DEVICE_BTN = "main button:has-text('Add Device')";

    // Search input
    private static final String SEARCH_INPUT = "input[placeholder='Search for Devices']";

    // Open Filters button (the funnel/filter icon button)
    private static final String OPEN_FILTERS_BTN = "button[aria-label='Open filters']";

    // "Showing N results" counter
    private static final String RESULTS_COUNT = "main *:text-matches('^Showing \\\\d+ results$')";

    // ── Device row ────────────────────────────────────────────────────────────
    // Each row is a card: div.relative.rounded-[6px].bg-ods-card.cursor-pointer
    private static final String DEVICE_ROW = "main div.relative.cursor-pointer";

    // Within a row: device name <p>, status <span>, last-seen <span>, OS column
    private static final String ROW_NAME = "p.leading-\\[24px\\]";
    private static final String ROW_STATUS = "span.shrink-0";

    // Three-dot context menu trigger inside a row
    private static final String ROW_MENU_BTN = "button[aria-haspopup='menu'][data-state='closed']," +
            "button[aria-haspopup='menu'][data-state='open']";

    // ── Filter panel (slide-up) ───────────────────────────────────────────────
    private static final String FILTER_PANEL = "[class*='slide-in-from-bo']";
    private static final String FILTER_RESET_BTN = FILTER_PANEL + " button:has-text('Reset Filters')";
    private static final String FILTER_APPLY_BTN = FILTER_PANEL + " button:has-text('Apply Filters')";

    // Checkboxes inside the filter panel (Radix Checkbox → role="checkbox")
    private static final String FILTER_CHECKBOX_OFFLINE = FILTER_PANEL + " button[role='checkbox']:near(:text('OFFLINE'))";
    private static final String FILTER_CHECKBOX_ONLINE = FILTER_PANEL + " button[role='checkbox']:near(:text('ONLINE'))";
    private static final String FILTER_CHECKBOX_ARCHIVED = FILTER_PANEL + " button[role='checkbox']:near(:text('ARCHIVED'))";
    private static final String FILTER_CHECKBOX_WINDOWS = FILTER_PANEL + " button[role='checkbox']:near(:text('WINDOWS'))";
    private static final String FILTER_CHECKBOX_MACOS = FILTER_PANEL + " button[role='checkbox']:near(:text('MAC_OS'))";

    // ── Context-menu items (rendered in a Radix [role="menu"]) ───────────────
    private static final String CTX_MENU = "[role='menu']";
    private static final String CTX_REMOTE_CONTROL = CTX_MENU + " div:has-text('Remote Control')";
    private static final String CTX_REMOTE_SHELL = CTX_MENU + " div:has-text('Remote Shell')";
    private static final String CTX_MANAGE_FILES = CTX_MENU + " div:has-text('Manage Files')";
    private static final String CTX_RUN_SCRIPT = CTX_MENU + " div:has-text('Run Script')";
    private static final String CTX_UNINSTALL = CTX_MENU + " div:has-text('Uninstall Device')";
    private static final String CTX_ARCHIVE = CTX_MENU + " div:has-text('Archive Device')";
    private static final String CTX_DELETE = CTX_MENU + " div:has-text('Delete Device')";

    // ── Constructor ──────────────────────────────────────────────────────────
    public DevicesPage(Page page) {
        this.page = page;
    }

    // ── Page-level locators ──────────────────────────────────────────────────

    public Locator pageHeading() {
        return page.locator(PAGE_HEADING).first();
    }

    public Locator gridViewButton() {
        return page.locator(GRID_VIEW_BTN);
    }

    public Locator tableViewButton() {
        return page.locator(TABLE_VIEW_BTN);
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

    public Locator resultsCount() {
        return page.locator(RESULTS_COUNT);
    }

    // All device row cards
    public Locator deviceRows() {
        return page.locator(DEVICE_ROW);
    }

    // A specific device row by its visible name text
    public Locator deviceRowByName(String name) {
        return page.locator(DEVICE_ROW + ":has-text('" + name + "')").first();
    }

    // The three-dot menu button within a named row
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

    public Locator filterOfflineCheckbox() {
        return page.locator(FILTER_CHECKBOX_OFFLINE);
    }

    public Locator filterOnlineCheckbox() {
        return page.locator(FILTER_CHECKBOX_ONLINE);
    }

    public Locator filterArchivedCheckbox() {
        return page.locator(FILTER_CHECKBOX_ARCHIVED);
    }

    public Locator filterWindowsCheckbox() {
        return page.locator(FILTER_CHECKBOX_WINDOWS);
    }

    public Locator filterMacOsCheckbox() {
        return page.locator(FILTER_CHECKBOX_MACOS);
    }

    // ── Context-menu locators ────────────────────────────────────────────────

    public Locator contextMenu() {
        return page.locator(CTX_MENU);
    }

    public Locator ctxRemoteControlItem() {
        return page.locator(CTX_REMOTE_CONTROL).first();
    }

    public Locator ctxRemoteShellItem() {
        return page.locator(CTX_REMOTE_SHELL).first();
    }

    public Locator ctxManageFilesItem() {
        return page.locator(CTX_MANAGE_FILES).first();
    }

    public Locator ctxRunScriptItem() {
        return page.locator(CTX_RUN_SCRIPT).first();
    }

    public Locator ctxUninstallItem() {
        return page.locator(CTX_UNINSTALL).first();
    }

    public Locator ctxArchiveItem() {
        return page.locator(CTX_ARCHIVE).first();
    }

    public Locator ctxDeleteItem() {
        return page.locator(CTX_DELETE).first();
    }

    // ── Derived helpers ───────────────────────────────────────────────────────

    public String getPageHeading() {
        return pageHeading().innerText().trim();
    }

    public int getResultsCount() {
        String text = resultsCount().innerText().trim(); // "Showing 12 results"
        return Integer.parseInt(text.replaceAll("\\D+", ""));
    }

    public boolean isTableViewActive() {
        return "true".equals(tableViewButton().getAttribute("aria-checked"));
    }

    public boolean isGridViewActive() {
        return "true".equals(gridViewButton().getAttribute("aria-checked"));
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    /**
     * Types into the search bar and waits for the results to settle.
     */
    public DevicesPage searchFor(String query) {
        searchInput().fill(query);
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Clears the search bar.
     */
    public DevicesPage clearSearch() {
        searchInput().clear();
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
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
     * Opens the Sort and Filter panel.
     */
    public DevicesPage openFilterPanel() {
        openFiltersButton().click();
        filterPanel().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(5_000));
        return this;
    }

    /**
     * Applies the currently selected filter checkboxes.
     */
    public DevicesPage applyFilters() {
        filterApplyButton().click();
        filterPanel().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.HIDDEN)
                .setTimeout(5_000));
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Resets all filter checkboxes.
     */
    public DevicesPage resetFilters() {
        filterResetButton().click();
        return this;
    }

    /**
     * Opens the three-dot context menu on the named device row.
     */
    public DevicesPage openContextMenuFor(String deviceName) {
        rowMenuButtonByName(deviceName).click();
        contextMenu().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(5_000));
        return this;
    }

    /**
     * Clicks "Remote Control" in the currently open context menu and returns
     * the resulting RemoteDesktopPage.
     */
    public RemoteDesktopPage clickRemoteControlInMenu() {
        ctxRemoteControlItem().click();
        page.waitForURL(
                url -> url.contains("/remote-desktop/"),
                new Page.WaitForURLOptions().setTimeout(15_000)
        );
        return new RemoteDesktopPage(page);
    }

    /**
     * Clicks a device row by name and returns the DeviceDetailsPage.
     */
    public DeviceDetailsPage openDevice(String deviceName) {
        deviceRowByName(deviceName).click();
        page.waitForURL(
                url -> url.contains("/devices/details/"),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
        DeviceDetailsPage deviceDetailsPage = new DeviceDetailsPage(page);
        page.waitForCondition(deviceDetailsPage::isLoaded);
        return deviceDetailsPage;
    }

    public boolean isLoaded() {
        return page.url().contains(URL_FRAGMENT) && addDeviceButton().isVisible();
    }
}