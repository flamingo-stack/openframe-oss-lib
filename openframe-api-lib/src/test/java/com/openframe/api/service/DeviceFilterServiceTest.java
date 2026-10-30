package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterFacet;
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.pinot.repository.PinotDeviceRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.document.rmm.script.OsType.MAC_OS;
import static com.openframe.data.document.rmm.script.OsType.WINDOWS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * Each facet is one Pinot round trip, so what matters here is which repository methods are NOT
 * called: the selection-set narrowing is the whole point of the second {@code getDeviceFilters}
 * overload.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeviceFilterServiceTest {

    private static final String TENANT = "tenant-1";

    @Mock private PinotDeviceRepository pinotDeviceRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private com.openframe.data.repository.organization.OrganizationRepository organizationRepository;

    private DeviceFilterService service() {
        return service(true);
    }

    private DeviceFilterService service(boolean directoryFacetsEnabled) {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        // Direct executor: the production pool is about wall-clock, not semantics, and running the
        // facet queries inline keeps assertion order deterministic.
        return new DeviceFilterService(
                pinotDeviceRepository,
                new DeviceFilterOptionMapper(organizationRepository),
                tenantIdProvider,
                Runnable::run,
                directoryFacetsEnabled);
    }

    @Test
    void filteredCountOnly_runsOneQueryAndSkipsEveryFacet() {
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(7);

        DeviceFilters result = service()
                .getDeviceFilters(DeviceFilterCriteria.builder().build(), Set.of(DeviceFilterFacet.FILTERED_COUNT))
                .join();

        assertThat(result.getFilteredCount()).isEqualTo(7);
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verifyNoMoreInteractions(pinotDeviceRepository);
    }

    @Test
    void unrequestedFacetsAreEmptyListsNotNull() {
        DeviceFilters result = service()
                .getDeviceFilters(DeviceFilterCriteria.builder().build(), Set.of(DeviceFilterFacet.FILTERED_COUNT))
                .join();

        // The GraphQL type declares these non-null, so an unselected facet must not surface as null
        // if it is ever read.
        assertThat(result.getStatuses()).isEmpty();
        assertThat(result.getDeviceTypes()).isEmpty();
        assertThat(result.getOsTypes()).isEmpty();
        assertThat(result.getOrganizationIds()).isEmpty();
        assertThat(result.getTagKeys()).isEmpty();
    }

    @Test
    void dashboardCounterSelection_runsOnlyItsTwoQueries() {
        when(pinotDeviceRepository.getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of("ONLINE", 3));
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(3);

        DeviceFilters result = service()
                .getDeviceFilters(DeviceFilterCriteria.builder().build(),
                        EnumSet.of(DeviceFilterFacet.STATUSES, DeviceFilterFacet.FILTERED_COUNT))
                .join();

        assertThat(result.getStatuses()).hasSize(1);
        assertThat(result.getFilteredCount()).isEqualTo(3);
        verify(pinotDeviceRepository, never())
                .getDeviceTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never())
                .getOsTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never())
                .getOrganizationFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never())
                .getTagKeyFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void nullFacetSet_keepsTheOldAllFacetsBehaviour() {
        service().getDeviceFilters(DeviceFilterCriteria.builder().build(), null).join();

        verify(pinotDeviceRepository).getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getDeviceTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getOsTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getOrganizationFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getTagKeyFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void singleArgOverload_stillRequestsEveryFacet() {
        service().getDeviceFilters(DeviceFilterCriteria.builder().build()).join();

        verify(pinotDeviceRepository).getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void nullOsTypesCriteria_doesNotNpe_passesEmptyOsTypesToPinot() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> osTypes = ArgumentCaptor.forClass(List.class);
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(0);

        service().getDeviceFilters(DeviceFilterCriteria.builder().build(),
                Set.of(DeviceFilterFacet.FILTERED_COUNT)).join();

        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), osTypes.capture(), any(), any(), any(), any(), any());
        assertThat(osTypes.getValue()).isEmpty();
    }

    @Test
    void osTypesCriteria_mappedToEnumNamesForPinot() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> osTypes = ArgumentCaptor.forClass(List.class);
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(0);

        service().getDeviceFilters(DeviceFilterCriteria.builder().osTypes(List.of(MAC_OS, WINDOWS)).build(),
                Set.of(DeviceFilterFacet.FILTERED_COUNT)).join();

        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), osTypes.capture(), any(), any(), any(), any(), any());
        assertThat(osTypes.getValue()).containsExactly("MAC_OS", "WINDOWS");
    }

    @Test
    void directoryColumnsSelection_runsOnlyTheirTwoQueries() {
        when(pinotDeviceRepository.getDirectorySourceFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of("MICROSOFT_365", 4));
        when(pinotDeviceRepository.getUserLinkFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of("NONE", 9));

        DeviceFilters result = service()
                .getDeviceFilters(DeviceFilterCriteria.builder().build(),
                        EnumSet.of(DeviceFilterFacet.DIRECTORY_SOURCES, DeviceFilterFacet.USER_LINKS))
                .join();

        assertThat(result.getDirectorySources())
                .extracting(DeviceFilterOption::getValue, DeviceFilterOption::getLabel, DeviceFilterOption::getCount)
                .containsExactly(tuple("MICROSOFT_365", "MICROSOFT_365", 4));
        assertThat(result.getUserLinks())
                .extracting(DeviceFilterOption::getValue, DeviceFilterOption::getCount)
                .containsExactly(tuple("NONE", 9));
        verify(pinotDeviceRepository).getDirectorySourceFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getUserLinkFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verifyNoMoreInteractions(pinotDeviceRepository);
    }

    @Test
    void unrequestedDirectoryFacetsAreEmptyListsNotNull() {
        DeviceFilters result = service()
                .getDeviceFilters(DeviceFilterCriteria.builder().build(), Set.of(DeviceFilterFacet.FILTERED_COUNT))
                .join();

        assertThat(result.getDirectorySources()).isEmpty();
        assertThat(result.getUserLinks()).isEmpty();
    }

    @Test
    void directoryCriteria_passedToPinotAsEnumNames() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> sources = ArgumentCaptor.forClass(List.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> links = ArgumentCaptor.forClass(List.class);
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(0);
        DeviceFilterCriteria criteria = DeviceFilterCriteria.builder()
                .directorySources(List.of(DirectorySource.MICROSOFT_365))
                .userLinks(List.of(DirectoryUserLink.PRIMARY, DirectoryUserLink.NONE))
                .build();

        service().getDeviceFilters(criteria, Set.of(DeviceFilterFacet.FILTERED_COUNT)).join();

        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(),
                sources.capture(), links.capture());
        assertThat(sources.getValue()).containsExactly("MICROSOFT_365");
        assertThat(links.getValue()).containsExactly("PRIMARY", "NONE");
    }

    @Test
    void nullDirectoryCriteria_passEmptyListsToPinot() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> sources = ArgumentCaptor.forClass(List.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> links = ArgumentCaptor.forClass(List.class);
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(0);

        service().getDeviceFilters(DeviceFilterCriteria.builder().build(), Set.of(DeviceFilterFacet.FILTERED_COUNT)).join();

        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(),
                sources.capture(), links.capture());
        assertThat(sources.getValue()).isEmpty();
        assertThat(links.getValue()).isEmpty();
    }

    @Test
    void directoryFacetsDisabled_selectedDirectoryFacets_neverQueriedAndEmpty() {
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(5);

        DeviceFilters result = service(false)
                .getDeviceFilters(DeviceFilterCriteria.builder().build(), EnumSet.of(DeviceFilterFacet.DIRECTORY_SOURCES,
                        DeviceFilterFacet.USER_LINKS, DeviceFilterFacet.FILTERED_COUNT))
                .join();

        assertThat(result.getDirectorySources()).isEmpty();
        assertThat(result.getUserLinks()).isEmpty();
        assertThat(result.getFilteredCount()).isEqualTo(5);
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verifyNoMoreInteractions(pinotDeviceRepository);
    }

    @Test
    void directoryFacetsDisabled_allFacets_runsEveryOtherQuery() {
        service(false).getDeviceFilters(DeviceFilterCriteria.builder().build()).join();

        verify(pinotDeviceRepository).getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getDeviceTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getOsTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getOrganizationFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getTagKeyFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never()).getDirectorySourceFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never()).getUserLinkFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void directoryFacetsDisabled_directoryCriteriaStillFilter() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> sources = ArgumentCaptor.forClass(List.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> links = ArgumentCaptor.forClass(List.class);
        DeviceFilterCriteria criteria = DeviceFilterCriteria.builder()
                .directorySources(List.of(DirectorySource.MICROSOFT_365))
                .userLinks(List.of(DirectoryUserLink.SHARED))
                .build();

        service(false).getDeviceFilters(criteria, Set.of(DeviceFilterFacet.STATUSES)).join();

        verify(pinotDeviceRepository).getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any(),
                sources.capture(), links.capture());
        assertThat(sources.getValue()).containsExactly("MICROSOFT_365");
        assertThat(links.getValue()).containsExactly("SHARED");
    }

    @Test
    void directoryFacetsEnabled_allFacets_queriesTheDirectoryFacetsToo() {
        service(true).getDeviceFilters(DeviceFilterCriteria.builder().build()).join();

        verify(pinotDeviceRepository).getDirectorySourceFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getUserLinkFilterOptions(anyString(), any(), any(), any(), any(), any(), any(), any(), any());
    }
}
