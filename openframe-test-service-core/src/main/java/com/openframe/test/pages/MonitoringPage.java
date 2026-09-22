package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.TimeoutError;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.WaitForSelectorState;

// Page Object for the OpenFrame Monitoring page (/monitoring/). Contains two tabs: Policies and Queries.
public class MonitoringPage {

    private final Page page;

    // ── URL ──────────────────────────────────────────────────────────────────
    private static final String BASE_URL = "/monitoring";
    private static final String POLICIES_URL = "/monitoring";
    private static final String QUERIES_URL = "/monitoring?tab=queries";

    // The list arrives from its own query, later than the summary cards goToMonitoring() waits on, so a
    // read straight after navigation has to wait for the row itself.
    private static final double ROW_WAIT_TIMEOUT_MS = 15_000;

    // ── Tab navigation ────────────────────────────────────────────────────────
    private final Locator tabPolicies;
    private final Locator tabQueries;

    // ══════════════════════════════════════════════════════════════════════════
    // POLICIES TAB
    // ══════════════════════════════════════════════════════════════════════════

    // ── Page header ──────────────────────────────────────────────────────────
    private final Locator policiesHeading;
    private final Locator addPolicyButtonText;
    private final Locator addPolicyButtonIcon;
    private final Locator searchPoliciesInput;

    // ── Summary / metric cards ────────────────────────────────────────────────
    private final Locator totalPoliciesCard;
    private final Locator totalPoliciesValue;
    private final Locator complianceRateCard;
    private final Locator complianceRateRatio;
    private final Locator complianceRatePercent;
    private final Locator failedPoliciesCard;
    private final Locator failedPoliciesValue;
    private final Locator updatedCard;
    private final Locator updatedTimestamp;

    // ── Policies list table ───────────────────────────────────────────────────
    private final Locator resultsCountLabel;
    // Each row has direct-child divs: [0] Name | [1] Severity | [2] Status | [3] Actions | [4] Link
    private final Locator policyRows;

    // ══════════════════════════════════════════════════════════════════════════
    // QUERIES TAB
    // ══════════════════════════════════════════════════════════════════════════

    private final Locator queriesHeading;
    private final Locator addQueryButtonText;
    private final Locator addQueryButtonIcon;
    private final Locator searchQueriesInput;
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

    public MonitoringPage clickMoreActionsForPolicy(int rowIndex) {
        policyRows.nth(rowIndex)
                .locator("button[aria-label='More actions']")
                .click();
        return this;
    }

    public MonitoringPage clickPolicyRow(int rowIndex) {
        policyRows.nth(rowIndex).click();
        return this;
    }

    public String getPolicyStatusByName(String policyName) {
        Locator matchedRow = policyRows.filter(
                new Locator.FilterOptions().setHasText(policyName));

        // FIX: was `if (matchedRow.count() == 0) throw`. count() samples the DOM at that instant and
        // never auto-waits, so a read right after navigation threw on rows that were still arriving —
        // short-circuiting before the auto-waiting textContent() below ever got a chance. Wait for the
        // row instead, and keep the descriptive message for a policy that genuinely is not there.
        try {
            matchedRow.first().waitFor(new Locator.WaitForOptions()
                    .setState(WaitForSelectorState.VISIBLE)
                    .setTimeout(ROW_WAIT_TIMEOUT_MS));
        } catch (TimeoutError e) {
            throw new RuntimeException("No policy row found with name: " + policyName, e);
        }

        // :scope > div selects direct children only, giving a stable column mapping:
        // [0] Name  [1] Severity  [2] Status  [3] Actions  [4] Link
        // (The Platform column was removed from the UI, shifting Status 3 -> 2.)
        return matchedRow.first()
                .locator(":scope > div").nth(2)
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

    // FIX: was filtering on "Showing" — the actual label never contains that word.
    public String getResultsCountText() {
        return resultsCountLabel.textContent().trim();
    }

    // Deliberately an instantaneous sample: 0 is a legitimate answer (empty state), so this cannot wait
    // for a row without breaking absence checks. A caller that expects rows should pair it with
    // page.waitForCondition(...) rather than read it once.
    public int getPolicyRowCount() {
        return policyRows.count();
    }

    public String getPolicyName(int rowIndex) {
        // Direct child [0] is the name column; descend into its nested <p> or <div>.
        return policyRows.nth(rowIndex)
                .locator(":scope > div").first()
                .locator("p, div").first()
                .textContent().trim();
    }

    public String getPolicySeverity(int rowIndex) {
        // Direct child [1] = Severity column.
        return policyRows.nth(rowIndex)
                .locator(":scope > div").nth(1)
                .textContent().trim();
    }

    public String getPolicyStatus(int rowIndex) {
        // Direct child [2] = Status column (Platform column was removed from the UI).
        return policyRows.nth(rowIndex)
                .locator(":scope > div").nth(2)
                .textContent().trim();
    }

    // Scoped to the correct row to avoid matching the Failed Policies metric card badge.
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

    // Like the other is*Visible() predicates here it does not wait — false is a legitimate answer, and
    // these are meant to be fed to page.waitForCondition(...) (see NavigationSidebar.goToMonitoring).
    public boolean isPolicyRowVisible(int i) {
        return policyRows.nth(i).isVisible();
    }
}
