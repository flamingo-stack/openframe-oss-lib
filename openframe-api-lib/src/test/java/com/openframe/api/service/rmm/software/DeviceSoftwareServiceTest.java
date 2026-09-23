package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetMdmClientProvider;
import com.openframe.api.service.rmm.fleet.HostInventory;
import com.openframe.core.exception.BadRequestException;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;

import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.hostSoftware;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.title;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.vulnerability;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final int FIRST_PAGE = 0;
    private static final int PAGE_SIZE = 50;
    private static final String CVE_CRITICAL = "CVE-2024-0001";
    private static final String CVE_MEDIUM = "CVE-2024-0002";

    @Mock private DeviceHostInventoryLoader inventoryLoader;
    @Mock private FleetMdmClientProvider fleetClientProvider;
    @Mock private FleetDeviceCountEnricher deviceCountEnricher;

    @Captor private ArgumentCaptor<List<SoftwareResponse>> pageRowsCaptor;

    @InjectMocks private DeviceSoftwareService service;

    @Test
    void list_titleWithCves_rowCarriesInstalledVersionAndHostScopedSummary() {
        // setup
        stubInventory(
                List.of(title(11L, "node", "homebrew_packages", "20.1", CVE_CRITICAL, CVE_MEDIUM)),
                List.of(hostSoftware("node", "20.1",
                        vulnerability(CVE_CRITICAL, 9.8, null), vulnerability(CVE_MEDIUM, 5.0, null))));

        // execution
        PageResult<SoftwareResponse> result = service.list(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getId, SoftwareResponse::getName, SoftwareResponse::getSource,
                        SoftwareResponse::getCurrentVersion, SoftwareResponse::getOlderVersionsCount)
                .containsExactly(tuple("11", "node", SoftwareSource.BREW, "20.1", 0));
        assertThat(result.items())
                .extracting(row -> row.getVulnerabilitySummary().getCveCount(),
                        row -> row.getVulnerabilitySummary().getHighestSeverity())
                .containsExactly(tuple(2, SoftwareCveSeverity.CRITICAL));
    }

    @Test
    void list_titleWithoutCves_summaryIsNull() {
        // setup
        stubInventory(List.of(title(11L, "node", "homebrew_packages", "20.1")), List.of());

        // execution
        PageResult<SoftwareResponse> result = service.list(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getVulnerabilitySummary).containsOnlyNulls();
    }

    @Test
    void list_sourcesFilter_keepsMatchingTitlesOnly() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0"), title(11L, "node", "homebrew_packages", "20.1")),
                List.of());
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setSources(List.of(SoftwareSource.BREW));

        // execution
        PageResult<SoftwareResponse> result = service.list(MACHINE_ID, filter, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getName).containsExactly("node");
    }

    @Test
    void list_minSeverityHigh_titlesBelowBandExcluded() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0", CVE_CRITICAL),
                        title(11L, "node", "homebrew_packages", "20.1", CVE_MEDIUM)),
                List.of(hostSoftware("Google Chrome", "120.0", vulnerability(CVE_CRITICAL, 9.8, null)),
                        hostSoftware("node", "20.1", vulnerability(CVE_MEDIUM, 5.0, null))));
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setMinSeverity(SoftwareCveSeverity.HIGH);

        // execution
        PageResult<SoftwareResponse> result = service.list(MACHINE_ID, filter, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getName).containsExactly("Google Chrome");
    }

    @Test
    void list_defaultOrder_byNameCaseInsensitive() {
        // setup
        stubInventory(
                List.of(title(12L, "zsh", "homebrew_packages", "5.9"),
                        title(10L, "Google Chrome", "apps", "120.0"),
                        title(11L, "node", "homebrew_packages", "20.1")),
                List.of());

        // execution
        PageResult<SoftwareResponse> result = service.list(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome", "node", "zsh");
    }

    @Test
    void list_pageRequested_onlyPageItemsGetFleetWideDeviceCounts() {
        // setup
        stubInventory(
                List.of(title(10L, "Google Chrome", "apps", "120.0"),
                        title(11L, "node", "homebrew_packages", "20.1"),
                        title(12L, "zsh", "homebrew_packages", "5.9")),
                List.of());

        // execution
        PageResult<SoftwareResponse> result = service.list(MACHINE_ID, null, null, FIRST_PAGE, 2, null);

        // verifications
        assertThat(result.hasNext()).isTrue();
        assertThat(result.filteredCount()).isEqualTo(3);
        verify(deviceCountEnricher).enrich(pageRowsCaptor.capture(), any(Function.class), any(BiConsumer.class));
        assertThat(pageRowsCaptor.getValue())
                .extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome", "node");
    }

    @Test
    void list_emptyInventory_emptyPage() {
        // setup
        when(inventoryLoader.load(MACHINE_ID)).thenReturn(HostInventory.empty());

        // execution
        PageResult<SoftwareResponse> result = service.list(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, null);

        // verifications
        assertThat(result.items()).isEmpty();
        assertThat(result.filteredCount()).isZero();
    }

    @Test
    void list_unknownSortField_throwsBadRequestBeforeLoadingInventory() {
        // setup
        SortInput sort = SortInput.builder().field("publisher").build();

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.list(MACHINE_ID, null, null, FIRST_PAGE, PAGE_SIZE, sort));

        // verifications
        assertThat(ex.getMessage()).contains("publisher").contains("Sortable fields");
        verify(inventoryLoader, never()).load(MACHINE_ID);
    }

    private void stubInventory(List<HostSoftwareTitle> titles, List<FleetSoftware> hostSoftware) {
        when(inventoryLoader.load(MACHINE_ID)).thenReturn(HostInventory.of(titles, hostSoftware));
    }
}
