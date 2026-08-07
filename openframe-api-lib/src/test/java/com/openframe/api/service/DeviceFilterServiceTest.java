package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterFacet;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.data.pinot.repository.PinotDeviceRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
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
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        // Direct executor: the production pool is about wall-clock, not semantics, and running the
        // facet queries inline keeps assertion order deterministic.
        return new DeviceFilterService(
                pinotDeviceRepository,
                new DeviceFilterOptionMapper(organizationRepository),
                tenantIdProvider,
                Runnable::run);
    }

    @Test
    void filteredCountOnly_runsOneQueryAndSkipsEveryFacet() {
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any()))
                .thenReturn(7);

        DeviceFilters result = service()
                .getDeviceFilters(DeviceFilterCriteria.builder().build(), Set.of(DeviceFilterFacet.FILTERED_COUNT))
                .join();

        assertThat(result.getFilteredCount()).isEqualTo(7);
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any());
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
        when(pinotDeviceRepository.getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any()))
                .thenReturn(Map.of("ONLINE", 3));
        when(pinotDeviceRepository.getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any()))
                .thenReturn(3);

        DeviceFilters result = service()
                .getDeviceFilters(DeviceFilterCriteria.builder().build(),
                        EnumSet.of(DeviceFilterFacet.STATUSES, DeviceFilterFacet.FILTERED_COUNT))
                .join();

        assertThat(result.getStatuses()).hasSize(1);
        assertThat(result.getFilteredCount()).isEqualTo(3);
        verify(pinotDeviceRepository, never())
                .getDeviceTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never())
                .getOsTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never())
                .getOrganizationFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository, never())
                .getTagKeyFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void nullFacetSet_keepsTheOldAllFacetsBehaviour() {
        service().getDeviceFilters(DeviceFilterCriteria.builder().build(), null).join();

        verify(pinotDeviceRepository).getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getDeviceTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getOsTypeFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getOrganizationFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getTagKeyFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void singleArgOverload_stillRequestsEveryFacet() {
        service().getDeviceFilters(DeviceFilterCriteria.builder().build()).join();

        verify(pinotDeviceRepository).getStatusFilterOptions(anyString(), any(), any(), any(), any(), any(), any());
        verify(pinotDeviceRepository).getFilteredDeviceCount(anyString(), any(), any(), any(), any(), any(), any());
    }
}
