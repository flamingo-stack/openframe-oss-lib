package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;

/**
 * Page Object for the left navigation sidebar.
 * <p>
 * The sidebar is an <aside aria-label="Main navigation sidebar"> that exists
 * on every authenticated page of the application.
 * <p>
 * ── Collapsed (icon-only, width 56 px) ──────────────────────────────────────
 * Nav items show only an icon. The item label is carried as the
 * `title` attribute on the item for tooltip/accessibility purposes.
 * <p>
 * ── Expanded (icon + label, width 224 px) ───────────────────────────────────
 * Each nav item gains a <span class="text-h4"> child with the visible
 * label. A "Hide Menu" button appears at the bottom of the sidebar.
 * <p>
 * ── Element type ────────────────────────────────────────────────────────────
 * A nav item is an <a href> when it has a destination and a <button> when it
 * does not; the selectors here match either. Do not pin the tag.
 * <p>
 * ── Active item ─────────────────────────────────────────────────────────────
 * The currently active nav item carries aria-current="page" and is styled
 * with the yellow accent background.
 */
public class NavigationSidebar {

    private final Page page;

    // ── Root ─────────────────────────────────────────────────────────────────
    private static final String SIDEBAR = "aside[aria-label='Main navigation sidebar']";

    // A nav entry is an <a href> when it has a destination (Next <Link>, so the
    // route prefetches) and a <button> when it does not — disabled, no path, or
    // carrying its own onClick. See navigation-sidebar-item.tsx in
    // openframe-frontend-core. Match either: which one a given entry renders as
    // is a frontend implementation detail that has already changed once and
    // silently broke every UI test.
    private static final String NAV_ITEM = " :is(a, button)";

    private static final String PRIMARY_NAV = SIDEBAR + " nav[aria-label='Primary navigation']" + NAV_ITEM;
    private static final String SECONDARY_NAV = SIDEBAR + " nav[aria-label='Secondary navigation']" + NAV_ITEM;

    // ── Primary nav items  (stable: aria-label never changes) ────────────────
    private static final String NAV_DASHBOARD = PRIMARY_NAV + "[aria-label='Dashboard']";
    private static final String NAV_CUSTOMERS = PRIMARY_NAV + "[aria-label='Customers']";
    private static final String NAV_DEVICES = PRIMARY_NAV + "[aria-label='Devices']";
    private static final String NAV_SCRIPTS = PRIMARY_NAV + "[aria-label='Scripts']";
    private static final String NAV_MONITORING = PRIMARY_NAV + "[aria-label='Monitoring']";
    private static final String NAV_LOGS = PRIMARY_NAV + "[aria-label='Logs']";
    private static final String NAV_TICKETS = PRIMARY_NAV + "[aria-label='Tickets']";
    private static final String NAV_WORKTIME = PRIMARY_NAV + "[aria-label='Worktime']";

    // ── Secondary nav ────────────────────────────────────────────────────────
    private static final String NAV_KNOWLEDGE_BASE = SECONDARY_NAV + "[aria-label='Knowledge Base']";
    private static final String NAV_HELP_CENTER = SECONDARY_NAV + "[aria-label='Help Center']";
    private static final String NAV_SETTINGS = SECONDARY_NAV + "[aria-label='Settings']";

    // ── Collapse / expand ────────────────────────────────────────────────────
    // Genuinely a <button>: it toggles the sidebar and has no destination.
    private static final String HIDE_MENU_BTN = SIDEBAR + " button[aria-label='Hide Menu']";

    // ── Active item (any nav section) ────────────────────────────────────────
    private static final String ACTIVE_NAV_ITEM = SIDEBAR + NAV_ITEM + "[aria-current='page']";

    // ── Expected URL fragments for each nav item ─────────────────────────────
    private static final String URL_DASHBOARD = "/dashboard";
    private static final String URL_CUSTOMERS = "/customers";
    private static final String URL_DEVICES = "/devices";
    private static final String URL_SCRIPTS = "/scripts";
    private static final String URL_MONITORING = "/monitoring";
    private static final String URL_LOGS = "/logs";
    private static final String URL_TICKETS = "/tickets";
    private static final String URL_WORKTIME = "/worktime";
    private static final String URL_KNOWLEDGE_BASE = "/knowledge-base";
    private static final String URL_HELP_CENTER = "/help-center";
    private static final String URL_SETTINGS = "/settings";

    // ── Constructor ──────────────────────────────────────────────────────────
    public NavigationSidebar(Page page) {
        this.page = page;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Locators
    // ════════════════════════════════════════════════════════════════════════

    public Locator sidebar() {
        return page.locator(SIDEBAR);
    }

    public Locator dashboardNavItem() {
        return page.locator(NAV_DASHBOARD);
    }

    public Locator customersNavItem() {
        return page.locator(NAV_CUSTOMERS);
    }

    public Locator devicesNavItem() {
        return page.locator(NAV_DEVICES);
    }

    public Locator scriptsNavItem() {
        return page.locator(NAV_SCRIPTS);
    }

    public Locator monitoringNavItem() {
        return page.locator(NAV_MONITORING);
    }

    public Locator logsNavItem() {
        return page.locator(NAV_LOGS);
    }

    public Locator ticketsNavItem() {
        return page.locator(NAV_TICKETS);
    }

    public Locator worktimeNavItem() {
        return page.locator(NAV_WORKTIME);
    }

    public Locator knowledgeBaseNavItem() {
        return page.locator(NAV_KNOWLEDGE_BASE);
    }

    public Locator helpCenterNavItem() {
        return page.locator(NAV_HELP_CENTER);
    }

    public Locator settingsNavItem() {
        return page.locator(NAV_SETTINGS);
    }

    public Locator hideMenuButton() {
        return page.locator(HIDE_MENU_BTN);
    }

    public Locator activeNavItem() {
        return page.locator(ACTIVE_NAV_ITEM);
    }

    // ════════════════════════════════════════════════════════════════════════
    // State queries
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Returns {@code true} when the sidebar is in expanded (label-visible)
     * mode (width 224 px). Returns {@code false} in icon-only mode (56 px).
     * <p>
     * Expansion is detected by the presence of the "Hide Menu" button, which
     * only appears in the DOM when the sidebar is fully expanded.
     */
    public boolean isExpanded() {
        return hideMenuButton().isVisible();
    }

    /**
     * Returns {@code true} when the sidebar is in collapsed icon-only mode.
     */
    public boolean isCollapsed() {
        return !isExpanded();
    }

    /**
     * Returns the {@code aria-label} value of the currently active nav item
     * (e.g. {@code "Dashboard"}, {@code "Devices"}).
     */
    public String getActiveNavItemLabel() {
        return activeNavItem().getAttribute("aria-label");
    }

    /**
     * Returns {@code true} when the given nav button is the currently active
     * page item (i.e. carries {@code aria-current="page"}).
     *
     * @param navItemLocator one of the nav item locators from this class
     */
    public boolean isNavItemActive(Locator navItemLocator) {
        return "page".equals(navItemLocator.getAttribute("aria-current"));
    }

    // ════════════════════════════════════════════════════════════════════════
    // Navigation actions
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Navigates to the Dashboard and waits for the URL to settle.
     */
    public void goToDashboard() {
        clickNavItem(dashboardNavItem(), URL_DASHBOARD);
    }

    /**
     * Navigates to Customers.
     */
    public void goToCustomers() {
        clickNavItem(customersNavItem(), URL_CUSTOMERS);
    }

    /**
     * Navigates to Devices.
     */
    public DevicesPage goToDevices() {
        clickNavItem(devicesNavItem(), URL_DEVICES);
        DevicesPage devicesPage = new DevicesPage(this.page);
        page.waitForCondition(devicesPage::isLoaded,
                new Page.WaitForConditionOptions().setTimeout(120_000));
        return devicesPage;
    }

    /**
     * Navigates to Scripts.
     */
    public void goToScripts() {
        clickNavItem(scriptsNavItem(), URL_SCRIPTS);
    }

    /**
     * Navigates to Monitoring.
     */
    public MonitoringPage goToMonitoring() {
        clickNavItem(monitoringNavItem(), URL_MONITORING);
        MonitoringPage monitoringPage = new MonitoringPage(this.page);
        page.waitForCondition(monitoringPage::isTotalPoliciesCardVisible,
                new Page.WaitForConditionOptions().setTimeout(120_000));
        return monitoringPage;
    }

    /**
     * Navigates to Logs.
     */
    public void goToLogs() {
        clickNavItem(logsNavItem(), URL_LOGS);
    }

    /**
     * Navigates to Tickets.
     */
    public void goToTickets() {
        clickNavItem(ticketsNavItem(), URL_TICKETS);
    }

    /**
     * Navigates to Worktime.
     */
    public void goToWorktime() {
        clickNavItem(worktimeNavItem(), URL_WORKTIME);
    }

    /**
     * Navigates to the Knowledge Base.
     */
    public void goToKnowledgeBase() {
        clickNavItem(knowledgeBaseNavItem(), URL_KNOWLEDGE_BASE);
    }

    /**
     * Navigates to the Help Center.
     */
    public void goToHelpCenter() {
        clickNavItem(helpCenterNavItem(), URL_HELP_CENTER);
    }

    /**
     * Navigates to Settings.
     */
    public void goToSettings() {
        clickNavItem(settingsNavItem(), URL_SETTINGS);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Collapse / expand
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Collapses the sidebar to icon-only mode by clicking the "Hide Menu"
     * button. Does nothing if the sidebar is already collapsed.
     */
    public void collapse() {
        if (isExpanded()) {
            hideMenuButton().click();
            hideMenuButton().waitFor(new Locator.WaitForOptions()
                    .setState(WaitForSelectorState.HIDDEN)
                    .setTimeout(3_000));
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Clicks a nav button and waits for the browser URL to contain the
     * expected URL fragment before returning.
     *
     * @param item        the nav button locator
     * @param urlFragment the URL path fragment to wait for (e.g. "/devices")
     */
    private void clickNavItem(Locator item, String urlFragment) {
        item.click();
        page.waitForURL(
                url -> url.contains(urlFragment),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
    }
}