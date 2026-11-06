package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

// With the read model on, every list goes through the same policies, catalog and filters as the Fleet path.
@ExtendWith(MockitoExtension.class)
class SoftwareInventoryServiceReadModelTest {

    private static final String TENANT = "t1";

    @Mock private IntegratedToolRepository integratedToolRepository;
    @Mock private FleetDeviceCountEnricher deviceCountEnricher;
    @Mock private FleetHostMachineResolver hostMachineResolver;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private DeviceHostInventoryLoader deviceHostInventoryLoader;
    @Mock private DeviceSoftwareReadModelQuery deviceSoftwareReadModelQuery;
    @Mock private TenantSoftwareReadModelQuery tenantSoftwareReadModelQuery;
    @Mock private SoftwareAutoUpdateService autoUpdateService;
    @Mock private SoftwareCatalogStatus catalogStatus;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private OrganizationRepository organizationRepository;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(integratedToolRepository, deviceCountEnricher, hostMachineResolver,
                tenantIdProvider, deviceHostInventoryLoader, deviceSoftwareReadModelQuery, tenantSoftwareReadModelQuery,
                autoUpdateService, catalogStatus, tagAssignmentRepository, organizationRepository);
        ReflectionTestUtils.setField(service, "softwareReadModel", true);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    private static SoftwareResponse row(String id, SoftwareSource source) {
        return SoftwareResponse.builder().id(id).name("app-" + id).source(source).build();
    }

    private static SoftwareOnDeviceResponse onDevice(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return SoftwareOnDeviceResponse.builder().device(machine).status(SoftwareOnDeviceStatus.UP_TO_DATE).build();
    }

    private void verifyPoliciesThenCatalog() {
        InOrder order = inOrder(autoUpdateService, catalogStatus);
        order.verify(autoUpdateService).applyToSoftware(anyList());
        order.verify(catalogStatus).apply(anyList());
    }

    @Test
    void findById_unknown_isEmpty() {
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(false);

        assertThat(service.findById("42")).isEmpty();
        verifyNoInteractions(autoUpdateService, catalogStatus);
    }

    @Test
    void findById_appliesThePoliciesThenTheCatalog() {
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.BREW));

        assertThat(service.findById("42")).get().extracting(SoftwareResponse::getId).isEqualTo("42");
        verifyPoliciesThenCatalog();
    }

    @Test
    void listSoftware_appliesThePoliciesThenTheCatalogToThePage() {
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(row("1", SoftwareSource.BREW)), false, false, 1, 0);
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, "x", 0, 20, null, null)).thenReturn(page);

        assertThat(service.listSoftware("x", 0, 20, null, null).items()).hasSize(1);
        verifyPoliciesThenCatalog();
    }

    @Test
    void getSoftwareFilters_facetsCountTheStatuses() {
        SoftwareResponse title = row("1", SoftwareSource.BREW);
        when(tenantSoftwareReadModelQuery.allForFilters(TENANT, null)).thenReturn(List.of(title));
        doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            rows.forEach(r -> r.setAutoUpdate(SoftwareAutoUpdateStatus.OFF));
            return null;
        }).when(catalogStatus).apply(anyList());

        SoftwareFilters filters = service.getSoftwareFilters(null);

        assertThat(filters.getAutoUpdateStatuses()).extracting("value").containsExactly("OFF");
        verifyPoliciesThenCatalog();
    }

    @Test
    void listSoftwareForDevice_filtersBySourceAndAutoUpdate_afterTheStatuses() {
        List<SoftwareResponse> rows = new ArrayList<>(List.of(row("1", SoftwareSource.BREW), row("2", SoftwareSource.BREW),
                row("3", SoftwareSource.UNMANAGED)));
        when(deviceSoftwareReadModelQuery.rowsForDevice(TENANT, "m1", null)).thenReturn(rows);
        doAnswer(inv -> {
            List<SoftwareResponse> applied = inv.getArgument(1);
            applied.getFirst().setAutoUpdate(SoftwareAutoUpdateStatus.ON);
            return null;
        }).when(autoUpdateService).applyToSoftwareOnDevice(eq("m1"), anyList());
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setSources(List.of(SoftwareSource.BREW));
        filter.setAutoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.ON));

        PageResult<SoftwareResponse> result = service.listSoftwareForDevice("m1", filter, null, 0, 20, null);

        assertThat(result.items()).extracting(SoftwareResponse::getId).containsExactly("1");
        InOrder order = inOrder(autoUpdateService, catalogStatus);
        order.verify(autoUpdateService).applyToSoftwareOnDevice(eq("m1"), anyList());
        order.verify(catalogStatus).apply(anyList());
        verifyNoInteractions(deviceHostInventoryLoader, deviceCountEnricher);
    }

    @Test
    void getDeviceSoftwareFilters_policiesThenCatalog() {
        when(deviceSoftwareReadModelQuery.rowsForDevice(TENANT, "m1", "s")).thenReturn(List.of(row("1", SoftwareSource.BREW)));

        service.getDeviceSoftwareFilters("m1", "s");

        InOrder order = inOrder(autoUpdateService, catalogStatus);
        order.verify(autoUpdateService).applyToSoftwareOnDevice(eq("m1"), anyList());
        order.verify(catalogStatus).apply(anyList());
    }

    @Test
    void listDevicesForSoftware_comparesWithTheCatalogLatest_setsInstalledByAndAutoUpdate() {
        SoftwareResponse title = row("42", SoftwareSource.BREW);
        title.setLatestVersion("5.8.3");
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(title);
        doAnswer(inv -> {
            List<SoftwareResponse> titles = inv.getArgument(0);
            titles.getFirst().setLatestVersion("5.8.4");
            return null;
        }).when(catalogStatus).apply(anyList());
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, "5.8.4"))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2")));

        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 20, null);

        assertThat(result.items()).extracting(SoftwareOnDeviceResponse::getInstalledBy)
                .containsOnly(SoftwareSource.BREW);
        org.mockito.Mockito.verify(autoUpdateService).applyToDevices(eq("42"), anyList());
    }

    @Test
    void listDevicesForSoftware_unknownTitle_isEmpty_anAppIsNotInstalledByAManager() {
        when(tenantSoftwareReadModelQuery.exists(TENANT, "7")).thenReturn(false);
        when(tenantSoftwareReadModelQuery.exists(TENANT, "8")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "8")).thenReturn(row("8", SoftwareSource.UNMANAGED));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(eq(TENANT), eq("8"), any(), any()))
                .thenReturn(List.of(onDevice("m1")));

        assertThat(service.listDevicesForSoftware("7", null, null, 0, 20, null).items()).isEmpty();
        assertThat(service.listDevicesForSoftware("8", null, null, 0, 20, null).items().getFirst().getInstalledBy()).isNull();
    }

    @Test
    void listDevicesForSoftware_wingetMatch_managedOnlyWhereWingetRuns() {
        when(tenantSoftwareReadModelQuery.exists(TENANT, "9")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "9")).thenReturn(row("9", SoftwareSource.WINGET));
        SoftwareOnDeviceResponse withWinget = onDevice("m1");
        withWinget.getDevice().setPackageManagers(Map.of(PackageManagerType.WINGET, PackageManagerState.PRESENT));
        SoftwareOnDeviceResponse withoutWinget = onDevice("m2");
        withoutWinget.getDevice().setPackageManagers(Map.of(PackageManagerType.WINGET, PackageManagerState.MISSING));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(eq(TENANT), eq("9"), any(), any()))
                .thenReturn(List.of(withWinget, withoutWinget));

        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("9", null, null, 0, 20, null);

        assertThat(result.items()).extracting(SoftwareOnDeviceResponse::getInstalledBy)
                .containsExactly(SoftwareSource.WINGET, null);
    }
}
