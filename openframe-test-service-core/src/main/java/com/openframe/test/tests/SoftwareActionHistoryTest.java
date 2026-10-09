package com.openframe.test.tests;

import com.openframe.test.api.SoftwareActionApi;
import com.openframe.test.data.dto.shared.FilterOption;
import com.openframe.test.data.dto.softwareaction.SoftwareActionDevice;
import com.openframe.test.data.dto.softwareaction.SoftwareActionDeviceFilterInput;
import com.openframe.test.data.dto.softwareaction.SoftwareActionFilterInput;
import com.openframe.test.data.dto.softwareaction.SoftwareActionFilters;
import com.openframe.test.data.dto.softwareaction.SoftwareActionRun;
import com.openframe.test.data.dto.softwareaction.SoftwareActionRunConnection;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import static com.openframe.test.data.generator.SoftwareBundleGenerator.HARMLESS_WINGET_PACKAGE;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.INSTALL;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.WINGET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Software action history (CP-29), read-only: the newest finished install SoftwareBundleTest wrote (else the tenant's newest finished bundle install) is listed, read, drilled into and counted; the classes share no static state, so it is found in the tenant.
@Tag("saas")
@Tag("needs-device")
// After `functional`, where SoftwareBundleTest installs, on a pipeline run.
@Tag("post-mingo")
@Tag("software-actions")
@DisplayName("Software action history")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SoftwareActionHistoryTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final String PACKAGE = HARMLESS_WINGET_PACKAGE;
    private static final String COMPLETED = "COMPLETED";
    private static final String FAILED = "FAILED";
    private static final Set<String> STATUSES = Set.of("SCHEDULED", "IN_PROGRESS", COMPLETED, FAILED);
    private static final Set<String> ACTIONS = Set.of(INSTALL, "UPDATE");
    private static final Set<String> ENGINES = Set.of(WINGET, "BREW", "CHOCO");
    private static final SoftwareActionFilterInput FINISHED_INSTALLS = SoftwareActionFilterInput.builder()
            .statuses(List.of(COMPLETED)).actions(List.of(INSTALL)).engines(List.of(WINGET)).build();
    private static final int PAGE = 50;
    private static final String NO_MATCH = "e2e-no-such-" + RUN_ID;

    private static SoftwareActionRun subject;

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("List finished installs, newest first")
    @Order(1)
    public void testListActions() {
        SoftwareActionRunConnection ours = SoftwareActionApi.getActions(FINISHED_INSTALLS, PACKAGE, PAGE, null);
        assertFinishedInstalls(ours, PACKAGE);
        SoftwareActionRunConnection all = SoftwareActionApi.getActions(FINISHED_INSTALLS, null, PAGE, null);
        assertFinishedInstalls(all, "");
        assertThat(all.getFilteredCount()).as("Without the search at least as many rows match").isGreaterThanOrEqualTo(ours.getFilteredCount());

        // Prefer the install SoftwareBundleTest wrote; any finished bundle install in the tenant reads the same way.
        SoftwareActionRun own = fromBundle(ours);
        subject = own != null ? own : fromBundle(all);
        assumeTrue(subject != null, "No finished WINGET install from a bundle in this tenant's software action history;"
                + " SoftwareBundleTest's \"Submit a software bundle to install a package now\" writes one");
        assertThat(subject.getScheduleId()).as("A bundle (NOW) action has no schedule").isNull();

        SoftwareActionRunConnection first = SoftwareActionApi.getActions(FINISHED_INSTALLS, null, 1, null);
        assertThat(first.nodes()).extracting(SoftwareActionRun::getExecutionId).as("first: 1 returns the newest row")
                .containsExactly(all.nodes().getFirst().getExecutionId());
        assertThat(first.getPageInfo().getHasNextPage()).as("hasNextPage says whether rows follow the first")
                .isEqualTo(all.getFilteredCount() > 1);
    }

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("Read one software action by id")
    @Order(2)
    public void testReadAction() {
        requireSubject();
        SoftwareActionRun read = SoftwareActionApi.getAction(subject.getId());
        assertThat(read).as("softwareAction returns the listed row unchanged").usingRecursiveComparison().isEqualTo(subject);
    }

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("Drill into the devices of a software action")
    @Order(3)
    public void testActionDevices() {
        requireSubject();
        List<SoftwareActionDevice> devices = SoftwareActionApi.getActionExecutions(subject.getId(), null, null);
        assertThat(devices).as("A finished action lists its target devices").isNotEmpty();
        assertThat(devices).allSatisfy(d -> {
            assertThat(d.getMachineId()).as("Every device row has a machine id").isNotBlank();
            assertThat(d.getHostname()).as("Every device row is enriched with its hostname (%s)", d.getMachineId()).isNotBlank();
            assertThat(d.getStatus()).as("Status is a schema value (%s)", d.getMachineId()).isIn(STATUSES);
        });
        List<SoftwareActionDevice> finished = devices.stream().filter(d -> COMPLETED.equals(d.getStatus())).toList();
        assertThat(finished).as("respondedMachineCount counts the devices that finished").hasSize(subject.getRespondedMachineCount());
        assertThat(finished).allSatisfy(d -> {
            assertThat(d.getExitCode()).as("A COMPLETED device exited 0 (%s)", d.getHostname()).isZero();
            assertThat(d.getDispatchedAt()).as("A COMPLETED device was dispatched (%s)", d.getHostname()).isNotBlank();
            assertThat(d.getFinishedAt()).as("A COMPLETED device finished (%s)", d.getHostname()).isNotBlank();
        });

        assertThat(SoftwareActionApi.getActionExecutions(subject.getId(), byStatus(COMPLETED), null))
                .extracting(SoftwareActionDevice::getMachineId).as("The Status filter keeps the COMPLETED devices")
                .containsExactlyElementsOf(finished.stream().map(SoftwareActionDevice::getMachineId).toList());
        assertThat(SoftwareActionApi.getActionExecutions(subject.getId(), byStatus(FAILED), null))
                .as("A COMPLETED action has no FAILED device").isEmpty();

        SoftwareActionDevice one = finished.getFirst();
        assertThat(SoftwareActionApi.getActionExecutions(subject.getId(), null, one.getHostname().toUpperCase()))
                .extracting(SoftwareActionDevice::getMachineId).as("Search matches the hostname, case-insensitively").contains(one.getMachineId());
        assertThat(SoftwareActionApi.getActionExecutions(subject.getId(), null, one.getMachineId()))
                .extracting(SoftwareActionDevice::getMachineId).as("Search matches the machine id").contains(one.getMachineId());
        assertThat(SoftwareActionApi.getActionExecutions(subject.getId(), null, NO_MATCH))
                .as("A search no device matches lists nothing").isEmpty();

        assertThat(one.getOrganizationId()).as("The device carries its customer").isNotBlank();
        assertThat(SoftwareActionApi.getActionExecutions(subject.getId(), byCustomer(one.getOrganizationId()), null))
                .extracting(SoftwareActionDevice::getMachineId).as("The Customer filter keeps the device's own customer").contains(one.getMachineId());
        assertThat(SoftwareActionApi.getActionExecutions(subject.getId(), byCustomer(NO_MATCH), null))
                .as("A customer no device belongs to lists nothing").isEmpty();
    }

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("Count software actions by status, action and engine")
    @Order(4)
    public void testActionFilters() {
        requireSubject();
        String search = subject.getSoftware();
        int finishedTotal = SoftwareActionApi.getActions(FINISHED_INSTALLS, search, 1, null).getFilteredCount();
        SoftwareActionFilters finished = SoftwareActionApi.getActionFilters(FINISHED_INSTALLS, search);
        assertThat(finished.getFilteredCount()).as("filteredCount matches the list under the same filter and search").isEqualTo(finishedTotal);
        assertThat(finished.getStatuses()).extracting(FilterOption::getValue, FilterOption::getCount)
                .as("Under the filter, the only status is COMPLETED").containsExactly(tuple(COMPLETED, finishedTotal));
        assertThat(finished.getActions()).extracting(FilterOption::getValue, FilterOption::getCount)
                .as("Under the filter, the only action is INSTALL").containsExactly(tuple(INSTALL, finishedTotal));
        assertThat(finished.getEngines()).extracting(FilterOption::getValue, FilterOption::getCount)
                .as("Under the filter, the only engine is WINGET").containsExactly(tuple(WINGET, finishedTotal));

        int total = SoftwareActionApi.getActions(null, search, 1, null).getFilteredCount();
        SoftwareActionFilters all = SoftwareActionApi.getActionFilters(null, search);
        assertThat(all.getFilteredCount()).as("Unfiltered, filteredCount still matches the list").isEqualTo(total);
        assertFacet(all.getStatuses(), STATUSES, total, "status");
        assertFacet(all.getActions(), ACTIONS, total, "action");
        assertFacet(all.getEngines(), ENGINES, total, "engine");
        assertThat(all.getStatuses()).filteredOn(o -> COMPLETED.equals(o.getValue())).extracting(FilterOption::getCount)
                .as("Unfiltered, COMPLETED counts at least the finished installs").allSatisfy(c -> assertThat(c).isGreaterThanOrEqualTo(finishedTotal));
    }

    @Tag("feature")
    @Test
    @DisplayName("Read an empty software action history")
    @Order(5)
    public void testEmptyHistory() {
        SoftwareActionRunConnection none = SoftwareActionApi.getActions(null, NO_MATCH, PAGE, null);
        assertThat(none.getFilteredCount()).as("A search nothing matches counts 0").isZero();
        assertThat(none.nodes()).as("A search nothing matches lists no rows").isEmpty();
        assertThat(none.getPageInfo().getHasNextPage()).as("An empty page has no next page").isFalse();
        assertThat(none.getPageInfo().getHasPreviousPage()).as("The first page has no previous page").isFalse();

        SoftwareActionFilters noFacets = SoftwareActionApi.getActionFilters(null, NO_MATCH);
        assertThat(noFacets.getFilteredCount()).as("The facets agree with the empty list").isZero();
        assertThat(noFacets.getStatuses()).as("No status options without rows").isEmpty();
        assertThat(noFacets.getActions()).as("No action options without rows").isEmpty();
        assertThat(noFacets.getEngines()).as("No engine options without rows").isEmpty();

        assertThat(SoftwareActionApi.getAction(NO_MATCH)).as("softwareAction is null for an unknown id").isNull();
        assertThat(SoftwareActionApi.getActionExecutions(NO_MATCH, null, null)).as("An unknown action has no devices").isEmpty();
    }

    private static void assertFinishedInstalls(SoftwareActionRunConnection page, String search) {
        List<SoftwareActionRun> rows = page.nodes();
        assertThat(page.getPageInfo()).as("A connection carries pageInfo").isNotNull();
        assertThat(page.getFilteredCount()).as("filteredCount counts at least the rows on the page").isGreaterThanOrEqualTo(rows.size());
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.getId()).as("Every row has an id").isNotBlank();
            assertThat(r.getExecutionId()).as("Every row has an execution id").isNotBlank();
            assertThat(r.getStatus()).as("The status filter holds (%s)", r.getExecutionId()).isEqualTo(COMPLETED);
            assertThat(r.getAction()).as("The action filter holds (%s)", r.getExecutionId()).isEqualTo(INSTALL);
            assertThat(r.getEngine()).as("The engine filter holds (%s)", r.getExecutionId()).isEqualTo(WINGET);
            assertThat(r.getSoftware()).as("The search matches the package name (%s)", r.getExecutionId()).containsIgnoringCase(search);
            assertThat(r.getDispatchedAt()).as("A finished row was dispatched (%s)", r.getExecutionId()).isNotBlank();
            assertThat(r.getScheduledAt()).as("A dispatched row has no scheduledAt (%s)", r.getExecutionId()).isNull();
            assertThat(r.getRespondedMachineCount()).as("X of X / Y is within 1..Y (%s)", r.getExecutionId())
                    .isBetween(1, r.getTotalMachineCount());
        });
        assertThat(rows).extracting(r -> Instant.parse(r.getDispatchedAt())).as("Rows are newest first")
                .isSortedAccordingTo(Comparator.reverseOrder());
    }

    // The newest row a bundle (run now) produced, or null.
    private static SoftwareActionRun fromBundle(SoftwareActionRunConnection page) {
        return page.nodes().stream().filter(r -> r.getBundleId() != null).findFirst().orElse(null);
    }

    private static void assertFacet(List<FilterOption> facet, Set<String> values, int total, String name) {
        assertThat(facet).extracting(FilterOption::getValue).as("Every %s option is a schema value", name).allMatch(values::contains);
        assertThat(facet).allSatisfy(o -> assertThat(o.getLabel()).as("A %s option is labelled with its value", name).isEqualTo(o.getValue()));
        assertThat(facet.stream().mapToInt(FilterOption::getCount).sum()).as("The %s counts add up to filteredCount", name).isEqualTo(total);
    }

    private static SoftwareActionDeviceFilterInput byStatus(String status) {
        return SoftwareActionDeviceFilterInput.builder().statuses(List.of(status)).build();
    }

    private static SoftwareActionDeviceFilterInput byCustomer(String organizationId) {
        return SoftwareActionDeviceFilterInput.builder().organizationIds(List.of(organizationId)).build();
    }

    private static void requireSubject() {
        assumeTrue(subject != null, "No finished install was found in \"List finished installs, newest first\"; see why there");
    }
}
