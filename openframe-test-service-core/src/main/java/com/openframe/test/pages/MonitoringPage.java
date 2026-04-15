package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/**
 * Page Object for the OpenFrame Monitoring page.
 * URL: /monitoring/
 * Contains two tabs: Policies and Queries.
 */
public class MonitoringPage {

    private final Page page;

    // ── URL ──────────────────────────────────────────────────────────────────
    private static final String BASE_URL = "/monitoring/";
    private static final String POLICIES_URL = "/monitoring/";
    private static final String QUERIES_URL = "/monitoring/?tab=queries";

    // ── Tab navigation ────────────────────────────────────────────────────────
    /**
     * "Policies" tab button in the tab bar
     */
    private final Locator tabPolicies;
    /**
     * "Queries" tab button in the tab bar
     */
    private final Locator tabQueries;

    // ══════════════════════════════════════════════════════════════════════════
    // POLICIES TAB
    // ══════════════════════════════════════════════════════════════════════════

    // ── Page header ──────────────────────────────────────────────────────────
    /**
     * <h1>Policies</h1>
     */
    private final Locator policiesHeading;
    /**
     * Primary "Add Policy" button (text label, visible on larger screens)
     */
    private final Locator addPolicyButtonText;
    /**
     * Icon-only "Add Policy" button (aria-label, visible on smaller screens)
     */
    private final Locator addPolicyButtonIcon;
    /**
     * Search input field
     */
    private final Locator searchPoliciesInput;

    // ── Summary / metric cards ────────────────────────────────────────────────
    /**
     * Card containing "Total Policies" label and count value
     */
    private final Locator totalPoliciesCard;
    /**
     * Numeric value inside the Total Policies card
     */
    private final Locator totalPoliciesValue;
    /**
     * Card containing "Compliance Rate" label and ratio/percentage
     */
    private final Locator complianceRateCard;
    /**
     * Compliance ratio text, e.g. "2/2"
     */
    private final Locator complianceRateRatio;
    /**
     * Compliance percentage text, e.g. "100%"
     */
    private final Locator complianceRatePercent;
    /**
     * Card containing "Failed Policies" label, count, and percentage
     */
    private final Locator failedPoliciesCard;
    /**
     * Numeric value inside the Failed Policies card
     */
    private final Locator failedPoliciesValue;
    /**
     * "Updated" card showing last refresh timestamp
     */
    private final Locator updatedCard;
    /**
     * Timestamp text inside the Updated card, e.g. "3 minutes ago"
     */
    private final Locator updatedTimestamp;

    // ── Policies list table ───────────────────────────────────────────────────
    /**
     * Sticky column-header row (Name / Severity / Platform / Status)
     */
    private final Locator tableHeaderRow;
    /**
     * "Name" column header
     */
    private final Locator colHeaderName;
    /**
     * "Severity" column header
     */
    private final Locator colHeaderSeverity;
    /**
     * "Platform" column header
     */
    private final Locator colHeaderPlatform;
    /**
     * "Status" column header
     */
    private final Locator colHeaderStatus;
    /**
     * Result count label, e.g. "Showing 2 results"
     */
    private final Locator resultsCountLabel;
    /**
     * All policy row containers.
     * Each row contains: name/description | severity | platform | status badge | more-actions button.
     */
    private final Locator policyRows;

    // ══════════════════════════════════════════════════════════════════════════
    // QUERIES TAB
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * <h1>Queries</h1>
     */
    private final Locator queriesHeading;
    /**
     * Primary "Add Query" button (text label)
     */
    private final Locator addQueryButtonText;
    /**
     * Icon-only "Add Query" button (aria-label)
     */
    private final Locator addQueryButtonIcon;
    /**
     * Search input field on the Queries tab
     */
    private final Locator searchQueriesInput;
    /**
     * Empty-state message when no queries exist
     */
    private final Locator queriesEmptyState;


    // ══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════════

    public MonitoringPage(Page page) {
        this.page = page;

        // ── Tabs ──────────────────────────────────────────────────────────────
        tabPolicies = page.locator("main button[type='button']").filter(
                new Locator.FilterOptions().setHasText("Policies"));
        tabQueries = page.locator("main button[type='button']").filter(
                new Locator.FilterOptions().setHasText("Queries"));

        // ── Policies tab – header ─────────────────────────────────────────────
        policiesHeading = page.locator("main h1").filter(
                new Locator.FilterOptions().setHasText("Policies"));
        addPolicyButtonText = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Add Policy")).first();
        addPolicyButtonIcon = page.locator("main button[aria-label='Add Policy']");
        searchPoliciesInput = page.locator("main input[placeholder='Search for Policies']");

        // ── Policies tab – metric cards ────────────────────────────────────────
        totalPoliciesCard = page.locator("main div.bg-ods-card").filter(
                new Locator.FilterOptions().setHasText("Total Policies"));
        totalPoliciesValue = totalPoliciesCard.locator("p").nth(1);

        complianceRateCard = page.locator("main div.bg-ods-card").filter(
                new Locator.FilterOptions().setHasText("Compliance Rate"));
        complianceRateRatio = complianceRateCard.locator("p").filter(
                new Locator.FilterOptions().setHasText("/"));
        complianceRatePercent = complianceRateCard.locator("p").last();

        failedPoliciesCard = page.locator("main div.bg-ods-card").filter(
                new Locator.FilterOptions().setHasText("Failed Policies"));
        failedPoliciesValue = failedPoliciesCard.locator("p").nth(1);

        updatedCard = page.locator("main div.bg-ods-card").filter(
                new Locator.FilterOptions().setHasText("Updated"));
        updatedTimestamp = updatedCard.locator("p").last();

        // ── Policies tab – table ──────────────────────────────────────────────
        tableHeaderRow = page.locator("main div.hidden.md\\:flex.items-center.gap-4.px-4.py-3");
        colHeaderName = tableHeaderRow.locator("div").filter(
                new Locator.FilterOptions().setHasText("Name")).first();
        colHeaderSeverity = tableHeaderRow.locator("div").filter(
                new Locator.FilterOptions().setHasText("Severity")).first();
        colHeaderPlatform = tableHeaderRow.locator("div").filter(
                new Locator.FilterOptions().setHasText("Platform")).first();
        colHeaderStatus = tableHeaderRow.locator("div").filter(
                new Locator.FilterOptions().setHasText("Status")).first();
        resultsCountLabel = page.locator("main div").filter(
                new Locator.FilterOptions().setHasText("Showing")).last();
        policyRows = page.locator("main div[class*='h-[clamp']");

        // ── Queries tab ───────────────────────────────────────────────────────
        queriesHeading = page.locator("main h1").filter(
                new Locator.FilterOptions().setHasText("Queries"));
        addQueryButtonText = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Add Query")).first();
        addQueryButtonIcon = page.locator("main button[aria-label='Add Query']");
        searchQueriesInput = page.locator("main input[placeholder='Search for Queries']");
        queriesEmptyState = page.locator("main").filter(
                new Locator.FilterOptions().setHasText("No queries found."));
    }


    // ══════════════════════════════════════════════════════════════════════════
    // NAVIGATION
    // ══════════════════════════════════════════════════════════════════════════

    public MonitoringPage navigate() {
        page.navigate(BASE_URL);
        return this;
    }

    public MonitoringPage navigateToPoliciesTab() {
        page.navigate(POLICIES_URL);
        return this;
    }

    public MonitoringPage navigateToQueriesTab() {
        page.navigate(QUERIES_URL);
        return this;
    }


    // ══════════════════════════════════════════════════════════════════════════
    // TAB ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    public MonitoringPage clickPoliciesTab() {
        tabPolicies.click();
        return this;
    }

    public MonitoringPage clickQueriesTab() {
        tabQueries.click();
        return this;
    }


    // ══════════════════════════════════════════════════════════════════════════
    // POLICIES TAB – ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    public MonitoringPage clickAddPolicy() {
        addPolicyButtonText.click();
        return this;
    }

    public MonitoringPage searchPolicies(String query) {
        searchPoliciesInput.fill(query);
        return this;
    }

    public MonitoringPage clearPoliciesSearch() {
        searchPoliciesInput.clear();
        return this;
    }

    /**
     * Click the "More actions" (…) button for the policy row at the given 0-based index.
     */
    public MonitoringPage clickMoreActionsForPolicy(int rowIndex) {
        policyRows.nth(rowIndex)
                .locator("button[aria-label='More actions']")
                .click();
        return this;
    }

    /**
     * Click the row itself to open a policy detail view.
     */
    public MonitoringPage clickPolicyRow(int rowIndex) {
        policyRows.nth(rowIndex).click();
        return this;
    }

    /**
     * Returns the status badge text ("Compliant", "Non-Compliant", …)
     * for the policy row matching the given name.
     *
     * @param policyName exact visible name of the policy, e.g. "Windows version"
     * @return status text of the matched row
     * @throws RuntimeException if no row with that name is found
     */
    public String getPolicyStatusByName(String policyName) {
        Locator matchedRow = policyRows.filter(
                new Locator.FilterOptions().setHasText(policyName));

        if (matchedRow.count() == 0) {
            throw new RuntimeException("No policy row found with name: " + policyName);
        }

        // Status is the 4th child div of the row (index 3): Name | Severity | Platform | Status | Actions
        return matchedRow.first()
                .locator("div").nth(4)
                .textContent()
                .trim();
    }


    // ══════════════════════════════════════════════════════════════════════════
    // QUERIES TAB – ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    public MonitoringPage clickAddQuery() {
        addQueryButtonText.click();
        return this;
    }

    public MonitoringPage searchQueries(String query) {
        searchQueriesInput.fill(query);
        return this;
    }


    // ══════════════════════════════════════════════════════════════════════════
    // POLICIES TAB – GETTERS / ASSERTIONS HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    public String getPoliciesHeadingText() {
        return policiesHeading.textContent();
    }

    public int getTotalPoliciesCount() {
        return Integer.parseInt(totalPoliciesValue.textContent().trim());
    }

    public String getComplianceRateRatio() {
        return complianceRateRatio.textContent().trim();       // e.g. "2/2"
    }

    public String getComplianceRatePercent() {
        return complianceRatePercent.textContent().trim();     // e.g. "100%"
    }

    public int getFailedPoliciesCount() {
        return Integer.parseInt(failedPoliciesValue.textContent().trim());
    }

    public String getUpdatedTimestamp() {
        return updatedTimestamp.textContent().trim();          // e.g. "3 minutes ago"
    }

    public String getResultsCountText() {
        return resultsCountLabel.textContent().trim();         // e.g. "Showing 2 results"
    }

    public int getPolicyRowCount() {
        return policyRows.count();
    }

    /**
     * Returns the policy name from the row at the given 0-based index.
     */
    public String getPolicyName(int rowIndex) {
        return policyRows.nth(rowIndex)
                .locator("div").first()
                .locator("div").first()
                .locator("p, div").first()
                .textContent().trim();
    }

    /**
     * Returns the severity text ("Low", "Medium", "High") for a given row.
     */
    public String getPolicySeverity(int rowIndex) {
        // Severity is the 2nd child div of the row
        return policyRows.nth(rowIndex).locator("div").nth(1).textContent().trim();
    }

    /**
     * Returns the platform text ("All", "Windows", …) for a given row.
     */
    public String getPolicyPlatform(int rowIndex) {
        return policyRows.nth(rowIndex).locator("div").nth(2).textContent().trim();
    }

    /**
     * Returns the status badge text ("Compliant", "Non-Compliant", …) for a given row.
     */
    public String getPolicyStatus(int rowIndex) {
        return policyRows.nth(rowIndex).locator("div").nth(3).textContent().trim();
    }

    /**
     * Returns the Locator for the status badge div (for color / CSS class assertions).
     */
    public Locator getPolicyStatusBadge(int rowIndex) {
        return policyRows.nth(rowIndex)
                .locator("div[class*='bg-[var(--ods-attention']");
    }


    // ══════════════════════════════════════════════════════════════════════════
    // QUERIES TAB – GETTERS
    // ══════════════════════════════════════════════════════════════════════════

    public boolean isQueriesEmptyStateVisible() {
        return queriesEmptyState.isVisible();
    }

    public String getQueriesEmptyStateText() {
        return page.locator("main").getByText("No queries found.").textContent().trim();
    }


    // ══════════════════════════════════════════════════════════════════════════
    // VISIBILITY CHECKS
    // ══════════════════════════════════════════════════════════════════════════

    public boolean isPoliciesTabVisible() {
        return tabPolicies.isVisible();
    }

    public boolean isQueriesTabVisible() {
        return tabQueries.isVisible();
    }

    public boolean isAddPolicyButtonVisible() {
        return addPolicyButtonText.isVisible();
    }

    public boolean isAddQueryButtonVisible() {
        return addQueryButtonText.isVisible();
    }

    public boolean isSearchPoliciesVisible() {
        return searchPoliciesInput.isVisible();
    }

    public boolean isSearchQueriesVisible() {
        return searchQueriesInput.isVisible();
    }

    public boolean isTotalPoliciesCardVisible() {
        return totalPoliciesCard.isVisible();
    }

    public boolean isComplianceRateCardVisible() {
        return complianceRateCard.isVisible();
    }

    public boolean isFailedPoliciesCardVisible() {
        return failedPoliciesCard.isVisible();
    }

    public boolean isUpdatedCardVisible() {
        return updatedCard.isVisible();
    }

    public boolean isPolicyRowVisible(int i) {
        return policyRows.nth(i).isVisible();
    }
}
