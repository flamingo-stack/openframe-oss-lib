package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;

/**
 * Page Object for the Scripts section.
 * URL: /scripts/                       → Scripts List tab
 * URL: /scripts/?tab=schedules         → Scripts Schedules tab
 * <p>
 * ── Layout ───────────────────────────────────────────────────────────────────
 * A top tab bar switches between two sub-views:
 * • Scripts List     – searchable/filterable list of scripts, each with a
 * Run button and a ⋯ context menu (Edit Script, Script Details)
 * • Scripts Schedules – list of scheduled runs, each with an Edit button
 * <p>
 * Active tab is identified by a child <div class="…bg-ods-accent"> underline.
 */
public class ScriptsPage {

    public static final String URL = "https://test-qa.openframe.build/scripts/";
    public static final String URL_SCHEDULES = "https://test-qa.openframe.build/scripts/?tab=schedules";

    private final Page page;

    // ════════════════════════════════════════════════════════════════════════
    // Selectors
    // ════════════════════════════════════════════════════════════════════════

    // ── Tab bar ───────────────────────────────────────────────────────────
    private static final String TAB_SCRIPTS_LIST = "main button:has-text('Scripts List')";
    private static final String TAB_SCHEDULES = "main button:has-text('Scripts Schedules')";

    // Active tab indicator – a yellow underline div rendered inside the active button
    private static final String ACTIVE_TAB_INDICATOR = "main button div.bg-ods-accent";

    // ── Scripts List tab ──────────────────────────────────────────────────
    private static final String PAGE_HEADING = "main h1";
    private static final String ADD_SCRIPT_BTN = "main button:has-text('Add Script')";
    private static final String SEARCH_INPUT = "input[placeholder='Search for Scripts']";
    private static final String OPEN_FILTERS_BTN = "button[aria-label='Open filters']";
    private static final String RESULTS_COUNT = "main span:text-matches('^Showing \\d+ results$')";

    // Script rows: the card wrapper
    private static final String SCRIPT_ROW = "main div.relative.cursor-pointer";

    // Within a row – name is the first SPAN with ellipsis class
    private static final String ROW_NAME_SPAN = "span.text-h4.overflow-x-hidden";

    // Three-dot context menu trigger
    private static final String ROW_MENU_BTN = "button[aria-label='More actions']";

    // Context menu (Radix, role="menu")
    private static final String CTX_MENU = "[role='menu']";
    private static final String CTX_EDIT_SCRIPT = CTX_MENU + " [role='menuitem']:has-text('Edit Script')";
    private static final String CTX_SCRIPT_DETAILS = CTX_MENU + " [role='menuitem']:has-text('Script Details')";

    // Run button (type="submit", no aria-label – identified by position after ⋯ button)
    // Scoped inside a script row to avoid ambiguity
    private static final String ROW_RUN_BTN = SCRIPT_ROW + " button[type='submit']";

    // ── Filter panel (slide-up drawer) ────────────────────────────────────
    private static final String FILTER_PANEL = "[class*='slide-in-from-bottom']";
    private static final String FILTER_APPLY_BTN = FILTER_PANEL + " button:has-text('Apply Filters')";
    private static final String FILTER_RESET_BTN = FILTER_PANEL + " button:has-text('Reset Filters')";

    // Shell Type checkboxes
    private static final String FILTER_CMD = FILTER_PANEL + " button[role='checkbox']:near(:text('cmd'))";
    private static final String FILTER_POWERSHELL = FILTER_PANEL + " button[role='checkbox']:near(:text('powershell'))";
    private static final String FILTER_PYTHON = FILTER_PANEL + " button[role='checkbox']:near(:text('python'))";
    private static final String FILTER_SHELL = FILTER_PANEL + " button[role='checkbox']:near(:text('shell'))";

    // OS checkboxes
    private static final String FILTER_MACOS = FILTER_PANEL + " button[role='checkbox']:near(:text('macOS'))";
    private static final String FILTER_LINUX = FILTER_PANEL + " button[role='checkbox']:near(:text('Linux'))";
    private static final String FILTER_WINDOWS = FILTER_PANEL + " button[role='checkbox']:near(:text('Windows'))";

    // Added By checkboxes
    private static final String FILTER_TACTICAL = FILTER_PANEL + " button[role='checkbox']:near(:text('Tactical'))";

    // Category checkboxes
    private static final String FILTER_CUSTOM = FILTER_PANEL + " button[role='checkbox']:near(:text('Custom'))";
    private static final String FILTER_DEPRECATED = FILTER_PANEL + " button[role='checkbox']:near(:text('DEPRECATED'))";
    private static final String FILTER_OPENFRAME = FILTER_PANEL + " button[role='checkbox']:near(:text('OpenFrame'))";

    // ── Scripts Schedules tab ─────────────────────────────────────────────
    private static final String ADD_SCHEDULE_BTN = "main button:has-text('Add Schedule')";
    private static final String SEARCH_SCHEDULE = "input[placeholder='Search for Schedule']";
    private static final String SCHEDULE_ROW = "main div.relative.cursor-pointer";

    // Edit button on a schedule row (only button per row, no aria-label)
    private static final String SCHEDULE_EDIT_BTN = SCHEDULE_ROW + " button";

    // ════════════════════════════════════════════════════════════════════════
    // Constructor
    // ════════════════════════════════════════════════════════════════════════

    public ScriptsPage(Page page) {
        this.page = page;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Navigation
    // ════════════════════════════════════════════════════════════════════════

    public ScriptsPage navigate() {
        page.navigate(URL);
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    public ScriptsPage navigateToSchedules() {
        page.navigate(URL_SCHEDULES);
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Tab bar locators & actions
    // ════════════════════════════════════════════════════════════════════════

    public Locator scriptsListTab() {
        return page.locator(TAB_SCRIPTS_LIST);
    }

    public Locator schedulesTab() {
        return page.locator(TAB_SCHEDULES);
    }

    public Locator activeTabIndicator() {
        return page.locator(ACTIVE_TAB_INDICATOR);
    }

    /**
     * Returns the visible label of whichever tab is currently active.
     */
    public String getActiveTabLabel() {
        // The active button contains a bg-ods-accent underline div;
        // walk up to find its text span.
        Locator indicator = activeTabIndicator().first();
        return indicator.locator("..").locator("span").innerText().trim();
    }

    public void clickScriptsListTab() {
        scriptsListTab().click();
        page.waitForURL(url -> !url.contains("tab="), new Page.WaitForURLOptions().setTimeout(5_000));
    }

    public void clickSchedulesTab() {
        schedulesTab().click();
        page.waitForURL(url -> url.contains("tab=schedules"), new Page.WaitForURLOptions().setTimeout(5_000));
    }

    // ════════════════════════════════════════════════════════════════════════
    // Scripts List – page-level locators
    // ════════════════════════════════════════════════════════════════════════

    public Locator pageHeading() {
        return page.locator(PAGE_HEADING);
    }

    public Locator addScriptButton() {
        return page.locator(ADD_SCRIPT_BTN);
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

    /**
     * All script row cards currently rendered in the list.
     */
    public Locator scriptRows() {
        return page.locator(SCRIPT_ROW);
    }

    /**
     * A script row scoped by its visible name.
     */
    public Locator scriptRowByName(String name) {
        return page.locator(SCRIPT_ROW + ":has(" + ROW_NAME_SPAN + ":text('" + name + "'))");
    }

    /**
     * ⋯ More-actions button scoped to the named row.
     */
    public Locator rowMenuButton(String scriptName) {
        return scriptRowByName(scriptName).locator(ROW_MENU_BTN);
    }

    /**
     * ▷ Run button scoped to the named row.
     */
    public Locator rowRunButton(String scriptName) {
        return scriptRowByName(scriptName).locator("button[type='submit']");
    }

    // ════════════════════════════════════════════════════════════════════════
    // Scripts List – context menu locators
    // ════════════════════════════════════════════════════════════════════════

    public Locator contextMenu() {
        return page.locator(CTX_MENU);
    }

    public Locator ctxEditScript() {
        return page.locator(CTX_EDIT_SCRIPT);
    }

    public Locator ctxScriptDetails() {
        return page.locator(CTX_SCRIPT_DETAILS);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Filter panel locators
    // ════════════════════════════════════════════════════════════════════════

    public Locator filterPanel() {
        return page.locator(FILTER_PANEL);
    }

    public Locator filterApplyButton() {
        return page.locator(FILTER_APPLY_BTN);
    }

    public Locator filterResetButton() {
        return page.locator(FILTER_RESET_BTN);
    }

    // Shell Type
    public Locator filterCmdCheckbox() {
        return page.locator(FILTER_CMD);
    }

    public Locator filterPowershellCheckbox() {
        return page.locator(FILTER_POWERSHELL);
    }

    public Locator filterPythonCheckbox() {
        return page.locator(FILTER_PYTHON);
    }

    public Locator filterShellCheckbox() {
        return page.locator(FILTER_SHELL);
    }

    // OS
    public Locator filterMacOsCheckbox() {
        return page.locator(FILTER_MACOS);
    }

    public Locator filterLinuxCheckbox() {
        return page.locator(FILTER_LINUX);
    }

    public Locator filterWindowsCheckbox() {
        return page.locator(FILTER_WINDOWS);
    }

    // Added By
    public Locator filterTacticalCheckbox() {
        return page.locator(FILTER_TACTICAL);
    }

    // Category
    public Locator filterCustomCheckbox() {
        return page.locator(FILTER_CUSTOM);
    }

    public Locator filterDeprecatedCheckbox() {
        return page.locator(FILTER_DEPRECATED);
    }

    public Locator filterOpenFrameCheckbox() {
        return page.locator(FILTER_OPENFRAME);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Scripts Schedules – locators
    // ════════════════════════════════════════════════════════════════════════

    public Locator addScheduleButton() {
        return page.locator(ADD_SCHEDULE_BTN);
    }

    public Locator searchScheduleInput() {
        return page.locator(SEARCH_SCHEDULE);
    }

    public Locator scheduleRows() {
        return page.locator(SCHEDULE_ROW);
    }

    /**
     * A schedule row scoped by its visible name.
     */
    public Locator scheduleRowByName(String name) {
        return page.locator(SCHEDULE_ROW + ":has(span.text-h4:text('" + name + "'))");
    }

    /**
     * ✎ Edit button scoped to the named schedule row.
     */
    public Locator scheduleEditButton(String scheduleName) {
        return scheduleRowByName(scheduleName).locator("button");
    }

    // ════════════════════════════════════════════════════════════════════════
    // Derived state helpers
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Parses and returns the integer from "Showing N results".
     */
    public int getResultsCount() {
        return Integer.parseInt(
                resultsCount().innerText().trim().replaceAll("\\D+", "")
        );
    }

    /**
     * Returns {@code true} when the filter panel slide-up drawer is visible.
     */
    public boolean isFilterPanelOpen() {
        return filterPanel().isVisible();
    }

    // ════════════════════════════════════════════════════════════════════════
    // Actions – Scripts List
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Types into the scripts search box and waits for network to settle.
     */
    public ScriptsPage searchForScript(String query) {
        searchInput().fill(query);
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Clears the scripts search box.
     */
    public ScriptsPage clearSearch() {
        searchInput().clear();
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Opens the Sort and Filter drawer.
     */
    public ScriptsPage openFilterPanel() {
        openFiltersButton().click();
        filterPanel().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(5_000));
        return this;
    }

    /**
     * Clicks Apply Filters and waits for the drawer to close.
     */
    public ScriptsPage applyFilters() {
        filterApplyButton().click();
        filterPanel().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.HIDDEN)
                .setTimeout(5_000));
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Clicks Reset Filters inside the open filter drawer.
     */
    public ScriptsPage resetFilters() {
        filterResetButton().click();
        return this;
    }

    /**
     * Opens the ⋯ context menu on the named script row and waits for the
     * menu to become visible.
     */
    public ScriptsPage openContextMenu(String scriptName) {
        rowMenuButton(scriptName).click();
        contextMenu().waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(5_000));
        return this;
    }

    /**
     * Clicks "Edit Script" inside the currently open context menu.
     */
    public void clickEditScript() {
        ctxEditScript().click();
    }

    /**
     * Clicks "Script Details" inside the currently open context menu.
     */
    public void clickScriptDetails() {
        ctxScriptDetails().click();
    }

    /**
     * Clicks the ▷ Run button on the named script row.
     */
    public void clickRunScript(String scriptName) {
        rowRunButton(scriptName).click();
    }

    // ════════════════════════════════════════════════════════════════════════
    // Actions – Scripts Schedules
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Types into the schedule search box.
     */
    public ScriptsPage searchForSchedule(String query) {
        searchScheduleInput().fill(query);
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        return this;
    }

    /**
     * Clicks the ✎ Edit button on the named schedule row.
     */
    public void clickEditSchedule(String scheduleName) {
        scheduleEditButton(scheduleName).click();
    }
}