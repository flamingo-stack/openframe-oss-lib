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
    private static final String BASE_URL = "/monitoring";
    private static final String POLICIES_URL = "/monitoring";
    private static final String QUERIES_URL = "/monitoring?tab=queries";

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
     * Compliance ratio text, e.g. "1/1"
     */
    private final Locator complianceRateRatio;
    /**
     * Compliance percentage text, e.g. "(100%)"
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
     * Result count label, e.g. "1 result" or "2 results"
     */
    private final Locator resultsCountLabel;
    /**
     * All policy row containers (the inner flex row inside each card).
     * Each row has direct-child divs: [0] Name | [1] Severity | [2] Platform | [3] Status | [4] Actions | [5] Link
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
        addPolicyButtonText = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Add Policy")).first();
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
        // Result count lives in a <span> inside the sticky header above the list.
        resultsCountLabel = page.locator(
                "main span.text-ods-text-secondary.whitespace-nowrap");

        // FIX: was "div[class*='h-[clamp']" — actual class is h-[68px] md:h-[80px].
        // This is the inner flex row inside each policy card and is the correct
        // context element for column-index lookups via :scope > div.
        policyRows = page.locator("main div[class*='h-[68px]']");

        // ── Queries tab ───────────────────────────────────────────────────────
        queriesHeading = page.locator("main h1").filter(
                new Locator.FilterOptions().setHasText("Queries"));
        addQueryButtonText = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Add Query")).first();
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
     * @param policyName exact visible name of the policy, e.g. "test policy"
     * @return status text of the matched row
     * @throws RuntimeException if no row with that name is found
     */
    public String getPolicyStatusByName(String policyName) {
        Locator matchedRow = policyRows.filter(
                new Locator.FilterOptions().setHasText(policyName));

        if (matchedRow.count() == 0) {
            throw new RuntimeException("No policy row found with name: " + policyName);
        }

        // FIX: was locator("div").nth(4) — using all nested divs caused the extra
        // name-column wrapper div to shift every index by +1.
        // :scope > div selects direct children only, giving a stable column mapping:
        // [0] Name  [1] Severity  [2] Platform  [3] Status  [4] Actions  [5] Link
        return matchedRow.first()
                .locator(":scope > div").nth(3)
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
    // POLICIES TAB – GETTERS / ASSERTION HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    public String getPoliciesHeadingText() {
        return policiesHeading.textContent();
    }

    public int getTotalPoliciesCount() {
        return Integer.parseInt(totalPoliciesValue.textContent().trim());
    }

    public String getComplianceRateRatio() {
        return complianceRateRatio.textContent().trim();       // e.g. "1/1"
    }

    public String getComplianceRatePercent() {
        return complianceRatePercent.textContent().trim();     // e.g. "(100%)"
    }

    public int getFailedPoliciesCount() {
        return Integer.parseInt(failedPoliciesValue.textContent().trim());
    }

    public String getUpdatedTimestamp() {
        return updatedTimestamp.textContent().trim();          // e.g. "10 minutes ago"
    }

    /**
     * Returns the result count label text, e.g. "1 result" or "3 results".
     * FIX: was filtering on "Showing" — the actual label never contains that word.
     */
    public String getResultsCountText() {
        return resultsCountLabel.textContent().trim();
    }

    public int getPolicyRowCount() {
        return policyRows.count();
    }

    /**
     * Returns the policy name from the row at the given 0-based index.
     */
    public String getPolicyName(int rowIndex) {
        // Direct child [0] is the name column; descend into its nested <p> or <div>.
        return policyRows.nth(rowIndex)
                .locator(":scope > div").first()
                .locator("p, div").first()
                .textContent().trim();
    }

    /**
     * Returns the severity text ("Low", "Medium", "High") for a given row.
     * FIX: was locator("div").nth(1) — off by one due to extra nested name wrapper.
     * Direct child [1] = Severity column.
     */
    public String getPolicySeverity(int rowIndex) {
        return policyRows.nth(rowIndex)
                .locator(":scope > div").nth(1)
                .textContent().trim();
    }

    /**
     * Returns the platform text ("All", "Windows", …) for a given row.
     * FIX: was locator("div").nth(2) — off by one due to extra nested name wrapper.
     * Direct child [2] = Platform column.
     */
    public String getPolicyPlatform(int rowIndex) {
        return policyRows.nth(rowIndex)
                .locator(":scope > div").nth(2)
                .textContent().trim();
    }

    /**
     * Returns the status badge text ("Compliant", "Non-Compliant", …) for a given row.
     * FIX: was locator("div").nth(3) — off by one due to extra nested name wrapper.
     * Direct child [3] = Status column.
     */
    public String getPolicyStatus(int rowIndex) {
        return policyRows.nth(rowIndex)
                .locator(":scope > div").nth(3)
                .textContent().trim();
    }

    /**
     * Returns the Locator for the status badge div (for color / CSS class assertions).
     * Scoped to the correct row to avoid matching the Failed Policies metric card badge.
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