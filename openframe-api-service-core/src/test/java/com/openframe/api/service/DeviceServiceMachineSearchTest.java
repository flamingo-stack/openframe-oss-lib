package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineNameMatches;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceServiceMachineSearchTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private MachineRepository machineRepository;
    @Mock private DeletedMachineCleanup deletedMachineCleanup;
    @Mock private MachineWriter machineWriter;
    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private DeviceStatusProcessor deviceStatusProcessor;
    @Mock private DeviceFilterOptionMapper deviceFilterOptionMapper;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Captor private ArgumentCaptor<MachineQueryFilter> filterCaptor;
    @InjectMocks private DeviceService service;

    @Test
    void queryDevices_tagFilters_keepsRawTagsForTenantFencedQuery() {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .tagKeys(List.of("environment")).tagValues(List.of("production")).build();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(10).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.getDefaultSortField()).thenReturn("_id");
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                isNull(), eq(11), eq("_id"), eq("DESC"))).thenReturn(List.of());

        // execution
        service.queryDevices(filter, pagination, null, null);

        // verifications
        verify(machineRepository).countMachines(eq(TENANT_ID), filterCaptor.capture(), isNull());
        assertThat(filterCaptor.getValue()).extracting(MachineQueryFilter::getTagKeys, MachineQueryFilter::getTagValues)
                .containsExactly(List.of("environment"), List.of("production"));
    }

    @Test
    void queryDevices_directoryFilters_passedToTheMachineQuery() {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder()
                .directorySources(List.of(DirectorySource.MICROSOFT_365))
                .userLinks(List.of(DirectoryUserLink.NONE)).build();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(10).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.getDefaultSortField()).thenReturn("_id");
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                isNull(), eq(11), eq("_id"), eq("DESC"))).thenReturn(List.of());

        // execution
        service.queryDevices(filter, pagination, null, null);

        // verifications
        verify(machineRepository).countMachines(eq(TENANT_ID), filterCaptor.capture(), isNull());
        assertThat(filterCaptor.getValue())
                .extracting(MachineQueryFilter::getDirectorySources, MachineQueryFilter::getDirectoryUserLinks)
                .containsExactly(List.of(DirectorySource.MICROSOFT_365), List.of(DirectoryUserLink.NONE));
    }

    @Test
    void findDevicesAfter_sameFiltersAsDashboard_returnsSameMachinesAndPredicate() {
        // setup
        DeviceFilterCriteria filter = exactFilter();
        MachineQueryFilter expected = exactMachineFilter();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(10).build();
        Machine machine = machine();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.getDefaultSortField()).thenReturn("_id");
        when(machineRepository.countMachines(TENANT_ID, expected, null)).thenReturn(1L);
        when(machineRepository.findMachinesWithCursor(TENANT_ID, expected, null, null, 11, "_id", "DESC"))
                .thenReturn(List.of(machine));
        when(machineRepository.findMachinesAfter(TENANT_ID, expected, "previous-machine", 11))
                .thenReturn(List.of(machine));

        // execution
        CountedGenericQueryResult<Machine> dashboard = service.queryDevices(filter, pagination, null, null);
        List<Machine> tool = service.findDevicesAfter(filter, "previous-machine", 11);

        // verifications
        assertThat(dashboard.getItems()).containsExactlyElementsOf(tool);
        assertThat(tool).extracting(Machine::getMachineId).containsExactly("machine-1");
        assertThat(dashboard.getFilteredCount()).isEqualTo(1);
        verifyNoInteractions(tagRepository, tagAssignmentRepository);
    }

    @Test
    void findMatchingNames_exactCriteria_checksAllFilteredTenantMatches() {
        // setup
        DeviceFilterCriteria filter = exactFilter();
        MachineQueryFilter expected = exactMachineFilter();
        MachineNameMatches matches = new MachineNameMatches(List.of("HOST-1"), List.of("Reception Mac"));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findMatchingNames(TENANT_ID, expected)).thenReturn(matches);

        // execution
        MachineNameMatches result = service.findMatchingNames(filter);

        // verifications
        assertThat(result).isEqualTo(matches);
        verifyNoInteractions(tagRepository, tagAssignmentRepository);
    }

    @Test
    void findDevicesAfter_patternCriteria_preservesNameMatchingMode() {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().pattern("Reception*").build();
        MachineQueryFilter expected = MachineQueryFilter.builder().pattern("Reception*").build();
        Machine machine = machine();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findMachinesAfter(TENANT_ID, expected, null, 101)).thenReturn(List.of(machine));

        // execution
        List<Machine> result = service.findDevicesAfter(filter, null, 101);

        // verifications
        assertThat(result).extracting(Machine::getMachineId).containsExactly("machine-1");
    }

    @Test
    void findDevicesAfter_nullCriteria_preservesRepositoryDefaultStatusPolicy() {
        // setup
        MachineQueryFilter expected = new MachineQueryFilter();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findMachinesAfter(TENANT_ID, expected, null, 3)).thenReturn(List.of());

        // execution
        List<Machine> result = service.findDevicesAfter(null, null, 3);

        // verifications
        assertThat(result).isEmpty();
        verifyNoInteractions(tagRepository, tagAssignmentRepository);
    }

    @Test
    void queryAssignedDevices_tagCriteria_preservesAssignedScopeForCommonQuery() {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().tagKeys(List.of("environment")).build();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(10).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.getDefaultSortField()).thenReturn("_id");
        when(machineRepository.findMachinesWithCursor(eq(TENANT_ID), any(MachineQueryFilter.class), isNull(),
                isNull(), eq(11), eq("_id"), eq("DESC"))).thenReturn(List.of());

        // execution
        service.queryAssignedDevices(List.of("machine-1", "machine-2"), filter, pagination, null, null);

        // verifications
        verify(machineRepository).countMachines(eq(TENANT_ID), filterCaptor.capture(), isNull());
        assertThat(filterCaptor.getValue()).extracting(MachineQueryFilter::getRestrictToMachineIds,
                        MachineQueryFilter::getTagKeys)
                .containsExactly(List.of("machine-1", "machine-2"), List.of("environment"));
        verifyNoInteractions(tagRepository, tagAssignmentRepository);
    }

    @Test
    void legacyConstructor_existingSevenArguments_keepsNameFiltersAbsent() {
        // setup
        List<DeviceStatus> statuses = List.of(DeviceStatus.ONLINE);
        List<DeviceType> types = List.of(DeviceType.LAPTOP);
        List<OsType> osTypes = List.of(OsType.MAC_OS);
        List<String> organizations = List.of("organization-1");
        List<String> keys = List.of("environment");
        List<String> values = List.of("production");
        List<PackageManagerType> packageManagers = List.of(PackageManagerType.BREW);

        // execution
        DeviceFilterCriteria filter = new DeviceFilterCriteria(statuses, types, osTypes,
                organizations, keys, values, packageManagers);

        // verifications
        assertThat(filter).extracting(DeviceFilterCriteria::getStatuses, DeviceFilterCriteria::getDeviceTypes,
                        DeviceFilterCriteria::getOsTypes, DeviceFilterCriteria::getOrganizationIds,
                        DeviceFilterCriteria::getTagKeys, DeviceFilterCriteria::getTagValues,
                        DeviceFilterCriteria::getManageableByPackageManagers, DeviceFilterCriteria::getPattern,
                        DeviceFilterCriteria::getHostnames, DeviceFilterCriteria::getNicknames)
                .containsExactly(statuses, types, osTypes, organizations, keys, values, packageManagers,
                        null, null, null);
    }

    private DeviceFilterCriteria exactFilter() {
        return DeviceFilterCriteria.builder()
                .statuses(List.of(DeviceStatus.ONLINE)).deviceTypes(List.of(DeviceType.LAPTOP))
                .osTypes(List.of(OsType.MAC_OS)).organizationIds(List.of("organization-1"))
                .tagKeys(List.of("environment")).tagValues(List.of("production"))
                .manageableByPackageManagers(List.of(PackageManagerType.BREW))
                .hostnames(List.of("HOST-1")).nicknames(List.of("Reception Mac")).build();
    }

    private MachineQueryFilter exactMachineFilter() {
        return MachineQueryFilter.builder()
                .statuses(List.of("ONLINE")).deviceTypes(List.of("LAPTOP"))
                .osTypes(List.of(OsType.MAC_OS)).organizationIds(List.of("organization-1"))
                .tagKeys(List.of("environment")).tagValues(List.of("production"))
                .manageableByPackageManagers(List.of(PackageManagerType.BREW))
                .hostnames(List.of("HOST-1")).nicknames(List.of("Reception Mac")).build();
    }

    private Machine machine() {
        Machine machine = new Machine();
        machine.setId("012345678901234567890123");
        machine.setMachineId("machine-1");
        return machine;
    }

    @Test
    void getAssignedDeviceFilters_mongoFacets_directoryFacetsEmptyNotNull() {
        // setup
        DeviceFilterCriteria filter = DeviceFilterCriteria.builder().build();

        // execution
        DeviceFilters filters = service.getAssignedDeviceFilters(List.of("machine-1"), filter, null);

        // verifications
        assertThat(filters.getDirectorySources()).isNotNull().isEmpty();
        assertThat(filters.getUserLinks()).isNotNull().isEmpty();
    }
}
