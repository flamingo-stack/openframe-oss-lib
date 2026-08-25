package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;

// Nav item selectors match both <a> and <button>: which tag a given entry
// renders as is a frontend implementation detail that has already changed
// once and silently broke every UI test. See navigation-sidebar-item.tsx.
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

    // Expansion is detected via the "Hide Menu" button, which only exists in
    // the DOM when the sidebar is fully expanded.
    public boolean isExpanded() {
        return hideMenuButton().isVisible();
    }

    public boolean isCollapsed() {
        return !isExpanded();
    }

    public String getActiveNavItemLabel() {
        return activeNavItem().getAttribute("aria-label");
    }

    public boolean isNavItemActive(Locator navItemLocator) {
        return "page".equals(navItemLocator.getAttribute("aria-current"));
    }

    // ════════════════════════════════════════════════════════════════════════
    // Navigation actions
    // ════════════════════════════════════════════════════════════════════════

    public void goToDashboard() {
        clickNavItem(dashboardNavItem(), URL_DASHBOARD);
    }

    public void goToCustomers() {
        clickNavItem(customersNavItem(), URL_CUSTOMERS);
    }

    public DevicesPage goToDevices() {
        clickNavItem(devicesNavItem(), URL_DEVICES);
        DevicesPage devicesPage = new DevicesPage(this.page);
        page.waitForCondition(devicesPage::isLoaded,
                new Page.WaitForConditionOptions().setTimeout(120_000));
        return devicesPage;
    }

    public void goToScripts() {
        clickNavItem(scriptsNavItem(), URL_SCRIPTS);
    }

    public MonitoringPage goToMonitoring() {
        clickNavItem(monitoringNavItem(), URL_MONITORING);
        MonitoringPage monitoringPage = new MonitoringPage(this.page);
        page.waitForCondition(monitoringPage::isTotalPoliciesCardVisible,
                new Page.WaitForConditionOptions().setTimeout(120_000));
        return monitoringPage;
    }

    public void goToLogs() {
        clickNavItem(logsNavItem(), URL_LOGS);
    }

    public void goToTickets() {
        clickNavItem(ticketsNavItem(), URL_TICKETS);
    }

    public void goToWorktime() {
        clickNavItem(worktimeNavItem(), URL_WORKTIME);
    }

    public void goToKnowledgeBase() {
        clickNavItem(knowledgeBaseNavItem(), URL_KNOWLEDGE_BASE);
    }

    public void goToHelpCenter() {
        clickNavItem(helpCenterNavItem(), URL_HELP_CENTER);
    }

    public void goToSettings() {
        clickNavItem(settingsNavItem(), URL_SETTINGS);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Collapse / expand
    // ════════════════════════════════════════════════════════════════════════

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

    private void clickNavItem(Locator item, String urlFragment) {
        item.click();
        page.waitForURL(
                url -> url.contains(urlFragment),
                new Page.WaitForURLOptions().setTimeout(10_000)
        );
    }
}
