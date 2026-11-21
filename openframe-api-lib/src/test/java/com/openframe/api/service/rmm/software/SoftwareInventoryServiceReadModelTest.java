package com.openframe.api.service.rmm.software;

import com.openframe.audit.AuditedMethodRunner;
import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareFilterOption;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.api.dto.rmm.software.SoftwareAdoptionResponse;
import com.openframe.api.dto.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.nats.delivery.PackageAdoptReach;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

// With the read model on, every list goes through the same policies, catalog and filters as the Fleet path.
@ExtendWith(MockitoExtension.class)
class SoftwareInventoryServiceReadModelTest {

    private static final String TENANT = "t1";
    private static final SoftwareBundlePackage HIDDENBAR_CASK = SoftwareBundlePackage.builder()
            .packageManager(PackageManagerType.BREW).packageName("hiddenbar").brewPackageType(BrewPackageType.CASK)
            .build();

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
    @Mock private SoftwareScheduleRepository softwareScheduleRepository;
    @Mock private SoftwareScheduleTargetResolver softwareScheduleTargetResolver;
    @Mock private SoftwareAdoptionService softwareAdoptionService;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private PackageAdoptReach packageAdoptReach;

    private SoftwareInventoryService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareInventoryService(integratedToolRepository, deviceCountEnricher, hostMachineResolver,
                tenantIdProvider, deviceHostInventoryLoader, deviceSoftwareReadModelQuery, tenantSoftwareReadModelQuery,
                autoUpdateService, catalogStatus, tagAssignmentRepository, organizationRepository,
                softwareScheduleRepository, softwareScheduleTargetResolver,
                softwareAdoptionService, packageManagerAvailability, packageAdoptReach,
                mock(AuditedMethodRunner.class, CALLS_REAL_METHODS));
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

    private static SoftwareResponse named(String id, String name) {
        return SoftwareResponse.builder().id(id).name(name).source(SoftwareSource.BREW).build();
    }

    private void catalogSetsVersionStatus(Map<String, SoftwareVersionStatus> statusById) {
        doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            rows.forEach(r -> r.setVersionStatus(statusById.get(r.getId())));
            return null;
        }).when(catalogStatus).apply(anyList());
    }

    private void verifyPoliciesThenCatalog() {
        InOrder order = inOrder(autoUpdateService, catalogStatus);
        order.verify(autoUpdateService).applyToSoftware(anyList());
        order.verify(catalogStatus).apply(anyList());
    }

    private void stubUpcomingSchedules(SoftwareSchedule... schedules) {
        when(softwareScheduleRepository.findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(
                eq(TENANT), eq(ScriptStatus.ACTIVE), any(Instant.class))).thenReturn(List.of(schedules));
    }

    private void stubDeviceTimeSchedules(SoftwareSchedule... schedules) {
        when(softwareScheduleRepository.findByTenantIdAndStatusAndTriggerAndTimeReference(TENANT, ScriptStatus.ACTIVE,
                ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL)).thenReturn(List.of(schedules));
    }

    private static SoftwareSchedule schedule(SoftwareAction action, SoftwareSchedulePackage scheduledPackage) {
        return SoftwareSchedule.builder().tenantId(TENANT).action(action).packages(List.of(scheduledPackage)).build();
    }

    private static SoftwareSchedulePackage scheduledPackage(String softwareId, String packageName) {
        return SoftwareSchedulePackage.builder()
                .packageManager(PackageManagerType.BREW).packageName(packageName).softwareId(softwareId).build();
    }

    private void stubPolicyOn(String softwareId, String machineId) {
        doAnswer(inv -> {
            List<SoftwareOnDeviceResponse> rows = inv.getArgument(1);
            rows.stream()
                    .filter(row -> machineId.equals(row.getDevice().getMachineId()))
                    .forEach(row -> row.setAutoUpdate(SoftwareAutoUpdateStatus.ON));
            return null;
        }).when(autoUpdateService).applyToDevices(eq(softwareId), anyList());
    }

    private void catalogManagesWith(PackageCatalogEntry managingPackage) {
        doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            rows.forEach(r -> r.setManagingPackage(managingPackage));
            return null;
        }).when(catalogStatus).apply(anyList());
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
    void getManagingPackage_titleACatalogPackageManages_returnsThePackage() {
        PackageCatalogEntry xz = PackageCatalogEntry.builder().manager(PackageManagerType.BREW).packageId("xz").build();
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.BREW));
        catalogManagesWith(xz);

        assertThat(service.getManagingPackage("42")).isSameAs(xz);
    }

    @Test
    void getManagingPackage_titleNoPackageManages_badRequestNamingTheTitle() {
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.UNMANAGED));

        assertThatThrownBy(() -> service.getManagingPackage("42"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("No package manager manages app-42");
    }

    @Test
    void getManagingPackage_unknownSoftware_notFound() {
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(false);

        assertThatThrownBy(() -> service.getManagingPackage("42"))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Software not found: 42");
    }

    @Test
    void getAdoptableSoftware_titleWithAnAdoptionPackage_returnsTheTitle() {
        // setup
        SoftwareBundlePackage firefox = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.BREW)
                .packageName("firefox")
                .build();
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.UNMANAGED));
        doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            rows.forEach(row -> row.setAdoptionPackage(firefox));
            return null;
        }).when(catalogStatus).apply(anyList());

        // execution
        SoftwareResponse title = service.getAdoptableSoftware("42");

        // verifications
        assertThat(title)
                .extracting(SoftwareResponse::getId, SoftwareResponse::getAdoptionPackage)
                .containsExactly("42", firefox);
    }

    @Test
    void getAdoptableSoftware_titleWithoutAnAdoptionPackage_badRequestNamingTheTitle() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.UNMANAGED));

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.getAdoptableSoftware("42"));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("No package to adopt app-42 into");
    }

    @Test
    void getAdoptableSoftware_unknownSoftware_notFound() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(false);

        // execution
        NotFoundException notFound = assertThrows(NotFoundException.class, () -> service.getAdoptableSoftware("42"));

        // verifications
        assertThat(notFound.getMessage()).isEqualTo("Software not found: 42");
    }

    @Test
    void listDevicesForSoftware_adoptionOfADevice_thatRowCarriesItAndTheOthersNone() {
        // setup
        SoftwareAdoptionResponse adopting = SoftwareAdoptionResponse.builder()
                .status(SoftwareAdoptionStatus.ADOPTING)
                .packageManager(PackageManagerType.BREW)
                .build();
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.UNMANAGED));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2")));
        when(softwareAdoptionService.getAdoptionsByMachineId("42", List.of("m1", "m2")))
                .thenReturn(Map.of("m2", adopting));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 20, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareOnDeviceResponse::getAdoption)
                .containsExactly(null, adopting);
    }

    @Test
    void listDevicesForSoftware_moreDevicesThanThePage_adoptionsReadOnceForThePageOnly() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.UNMANAGED));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2"), onDevice("m3")));

        // execution
        service.listDevicesForSoftware("42", null, null, 0, 2, null);

        // verifications
        verify(softwareAdoptionService).getAdoptionsByMachineId("42", List.of("m1", "m2"));
        verifyNoMoreInteractions(softwareAdoptionService);
    }

    @Test
    void listSoftware_appliesThePoliciesThenTheCatalogToThePage() {
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(row("1", SoftwareSource.BREW)), false, false, 1, 0);
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, "x", 0, 20, null, null, null)).thenReturn(page);

        assertThat(service.listSoftware("x", 0, 20, null, null, null).items()).hasSize(1);
        verifyPoliciesThenCatalog();
    }

    @Test
    void listSoftware_adoptionPackage_countsOnlyDevicesAdoptSoftwareWouldOrder() {
        // setup
        SoftwareResponse hiddenBar = row("7", SoftwareSource.UNMANAGED);
        hiddenBar.setAdoptionPackage(HIDDENBAR_CASK);
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(hiddenBar), false, false, 1, 0);
        List<String> outsideUserApplications = List.of("m1", "m2", "m3", "m4");
        List<String> reachable = List.of("m1", "m2", "m3");
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, null, 0, 20, null, null, null)).thenReturn(page);
        when(deviceSoftwareReadModelQuery.machinesOutsideUserApplicationsByTitleId(TENANT, List.of(7L)))
                .thenReturn(Map.of(7L, outsideUserApplications));
        when(packageAdoptReach.filterReachable(outsideUserApplications)).thenReturn(reachable);
        when(packageManagerAvailability.adoptableOn(reachable, PackageManagerType.BREW))
                .thenReturn(List.of("m1", "m2"));
        when(deviceSoftwareReadModelQuery.caskTokensByMachineId(TENANT, reachable))
                .thenReturn(Map.of("m2", Set.of("hiddenbar"), "m1", Set.of("zed")));

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(null, 0, 20, null, null, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getAdoptionCount).containsExactly(1);
    }

    @Test
    void listSoftware_titleWithoutAnAdoptionPackage_zeroWithoutAnyLookup() {
        // setup
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(row("1", SoftwareSource.BREW)), false, false, 1, 0);
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, null, 0, 20, null, null, null)).thenReturn(page);

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(null, 0, 20, null, null, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getAdoptionCount).containsExactly(0);
        verifyNoInteractions(deviceSoftwareReadModelQuery, packageAdoptReach, packageManagerAvailability);
    }

    @Test
    void listSoftware_everyCopyOnlyInTheUsersApplicationsFolder_zeroWithoutReachOrManagerLookups() {
        // setup
        SoftwareResponse hiddenBar = row("7", SoftwareSource.UNMANAGED);
        hiddenBar.setAdoptionPackage(HIDDENBAR_CASK);
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(hiddenBar), false, false, 1, 0);
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, null, 0, 20, null, null, null)).thenReturn(page);
        when(deviceSoftwareReadModelQuery.machinesOutsideUserApplicationsByTitleId(TENANT, List.of(7L)))
                .thenReturn(Map.of());

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(null, 0, 20, null, null, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getAdoptionCount).containsExactly(0);
        verifyNoInteractions(packageAdoptReach, packageManagerAvailability);
    }

    @Test
    void listSoftware_chocoAndCaskTitlesOnOnePage_eachCountedWithItsOwnManager() {
        // setup
        SoftwareResponse hiddenBar = row("7", SoftwareSource.UNMANAGED);
        hiddenBar.setAdoptionPackage(HIDDENBAR_CASK);
        SoftwareResponse sevenZip = row("9", SoftwareSource.UNMANAGED);
        sevenZip.setAdoptionPackage(SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.CHOCO).packageName("7zip").build());
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(hiddenBar, sevenZip), false, false, 2, 0);
        List<String> machineIds = List.of("mac", "win");
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, null, 0, 20, null, null, null)).thenReturn(page);
        when(deviceSoftwareReadModelQuery.machinesOutsideUserApplicationsByTitleId(TENANT, List.of(7L, 9L)))
                .thenReturn(new TreeMap<>(Map.of(7L, List.of("mac"), 9L, List.of("win"))));
        when(packageAdoptReach.filterReachable(machineIds)).thenReturn(machineIds);
        when(packageManagerAvailability.adoptableOn(machineIds, PackageManagerType.BREW)).thenReturn(List.of("mac"));
        when(packageManagerAvailability.adoptableOn(machineIds, PackageManagerType.CHOCO)).thenReturn(List.of("win"));
        when(deviceSoftwareReadModelQuery.caskTokensByMachineId(TENANT, machineIds)).thenReturn(Map.of());

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(null, 0, 20, null, null, null);

        // verifications
        assertThat(result.items())
                .extracting(SoftwareResponse::getId, SoftwareResponse::getAdoptionCount)
                .containsExactly(tuple("7", 1), tuple("9", 1));
    }

    @Test
    void findById_titlePage_adoptionCountFilled() {
        // setup
        SoftwareResponse hiddenBar = row("7", SoftwareSource.UNMANAGED);
        hiddenBar.setAdoptionPackage(HIDDENBAR_CASK);
        List<String> machineIds = List.of("m1");
        when(tenantSoftwareReadModelQuery.exists(TENANT, "7")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "7")).thenReturn(hiddenBar);
        when(deviceSoftwareReadModelQuery.machinesOutsideUserApplicationsByTitleId(TENANT, List.of(7L)))
                .thenReturn(Map.of(7L, machineIds));
        when(packageAdoptReach.filterReachable(machineIds)).thenReturn(machineIds);
        when(packageManagerAvailability.adoptableOn(machineIds, PackageManagerType.BREW)).thenReturn(machineIds);
        when(deviceSoftwareReadModelQuery.caskTokensByMachineId(TENANT, machineIds)).thenReturn(Map.of());

        // execution
        Optional<SoftwareResponse> title = service.findById("7");

        // verifications
        assertThat(title).get().extracting(SoftwareResponse::getAdoptionCount).isEqualTo(1);
    }

    // the read model narrows by the stored match in Mongo; the rows that come back still get the statuses
    @Test
    void listSoftware_manageable_isTheReadModelsToNarrow() {
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(row("1", SoftwareSource.BREW)), false, false, 1, 0);
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setManageable(true);
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, null, 0, 20, null, null, filter)).thenReturn(page);

        assertThat(service.listSoftware(null, 0, 20, null, null, filter).items()).hasSize(1);
        verifyPoliciesThenCatalog();
    }

    @Test
    void listSoftware_sourcesAutoUpdateAndOsFilter_narrowedByTheReadModelNotInMemory() {
        // setup
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setSources(List.of(SoftwareSource.WINGET));
        filter.setAutoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.ON));
        filter.setOsTypes(List.of(OsType.WINDOWS));
        PageResult<SoftwareResponse> page = new PageResult<>(List.of(row("1", SoftwareSource.BREW)), false, false, 1, 0);
        when(tenantSoftwareReadModelQuery.listSoftware(TENANT, null, 0, 20, null, null, filter)).thenReturn(page);

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(null, 0, 20, null, null, filter);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getId).containsExactly("1");
        verifyPoliciesThenCatalog();
    }

    @Test
    void listMachineIdsForSoftware_readModelOn_machineIdsOfTheReadModelWithoutCatalogOrSchedules() {
        // setup
        when(tenantSoftwareReadModelQuery.machineIdsForSoftware(TENANT, "42")).thenReturn(List.of("m1", "m2"));

        // execution
        List<String> result = service.listMachineIdsForSoftware("42");

        // verifications
        assertThat(result).containsExactly("m1", "m2");
        verifyNoInteractions(catalogStatus, softwareScheduleRepository, hostMachineResolver);
    }

    @Test
    void listDevicesForSoftware_updateScheduledForTheSoftware_devicesOfTheScheduleAreScheduledUpdate() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.BREW));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2")));
        SoftwareSchedule update = schedule(SoftwareAction.UPDATE, scheduledPackage("42", "xz"));
        stubUpcomingSchedules(update);
        when(softwareScheduleTargetResolver.resolveMachineIds(update)).thenReturn(List.of("m1"));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 20, null);

        // verifications
        assertThat(result.items()).extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getStatus)
                .containsExactly(tuple("m1", SoftwareOnDeviceStatus.SCHEDULED_UPDATE),
                        tuple("m2", SoftwareOnDeviceStatus.UP_TO_DATE));
    }

    @Test
    void listDevicesForSoftware_updateScheduledForTheManagingPackage_filterByScheduledUpdateKeepsItsDevices() {
        // setup
        PackageCatalogEntry xz = PackageCatalogEntry.builder().manager(PackageManagerType.BREW).packageId("xz").build();
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.BREW));
        catalogManagesWith(xz);
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2")));
        SoftwareSchedule update = schedule(SoftwareAction.UPDATE, scheduledPackage(null, "xz"));
        SoftwareSchedule install = schedule(SoftwareAction.INSTALL, scheduledPackage(null, "xz"));
        stubUpcomingSchedules(update, install);
        when(softwareScheduleTargetResolver.resolveMachineIds(update)).thenReturn(List.of("m2"));
        SoftwareOnDeviceFilterInput filter = new SoftwareOnDeviceFilterInput();
        filter.setStatuses(List.of(SoftwareOnDeviceStatus.SCHEDULED_UPDATE));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", filter, null, 0, 20, null);

        // verifications
        assertThat(result.items()).extracting(row -> row.getDevice().getMachineId()).containsExactly("m2");
        verify(softwareScheduleTargetResolver, never()).resolveMachineIds(install);
    }

    @Test
    void listDevicesForSoftware_updateAtDeviceTime_onlyDevicesStillAwaitingTheRunAreScheduledUpdate() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.BREW));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2"), onDevice("m3")));
        SoftwareSchedule update = schedule(SoftwareAction.UPDATE, scheduledPackage("42", "xz"));
        update.setId("s1");
        SoftwareSchedule install = schedule(SoftwareAction.INSTALL, scheduledPackage("42", "xz"));
        stubDeviceTimeSchedules(update, install);
        when(softwareScheduleTargetResolver.resolveMachineIdsAwaitingDeviceTime(List.of(update)))
                .thenReturn(Map.of("s1", List.of("m1")));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 20, null);

        // verifications
        assertThat(result.items()).extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getStatus)
                .containsExactly(tuple("m1", SoftwareOnDeviceStatus.SCHEDULED_UPDATE),
                        tuple("m2", SoftwareOnDeviceStatus.UP_TO_DATE),
                        tuple("m3", SoftwareOnDeviceStatus.UP_TO_DATE));
    }

    @Test
    void getSoftwareFilters_facetsCountTheStatuses() {
        SoftwareResponse title = row("1", SoftwareSource.BREW);
        when(tenantSoftwareReadModelQuery.allTitles(TENANT, null, null, null)).thenReturn(List.of(title));
        doAnswer(inv -> {
            List<SoftwareResponse> rows = inv.getArgument(0);
            rows.forEach(r -> r.setAutoUpdate(SoftwareAutoUpdateStatus.OFF));
            return null;
        }).when(catalogStatus).apply(anyList());

        SoftwareFilters filters = service.getSoftwareFilters(null, null);

        assertThat(filters.getAutoUpdateStatuses()).extracting("value").containsExactly("OFF");
        verifyPoliciesThenCatalog();
    }

    @Test
    void getSoftwareFilters_filterWithMinSeverity_titlesOfTheFilterAndVulnerableOnlyCounted() {
        // setup
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setOsTypes(List.of(OsType.WINDOWS));
        filter.setMinSeverity(SoftwareCveSeverity.HIGH);
        SoftwareResponse chrome = row("1", SoftwareSource.WINGET);
        when(tenantSoftwareReadModelQuery.allTitles(TENANT, "chr", true, filter)).thenReturn(List.of(chrome));

        // execution
        SoftwareFilters filters = service.getSoftwareFilters(filter, "chr");

        // verifications
        assertThat(filters.getSources()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("WINGET", 1));
    }

    @Test
    void getSoftwareFilters_versionStatusesFilter_onlyTitlesWithTheChosenStatusesCounted() {
        // setup
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setVersionStatuses(List.of(SoftwareVersionStatus.OUTDATED));
        when(tenantSoftwareReadModelQuery.allTitles(TENANT, null, null, filter)).thenReturn(List.of(
                row("1", SoftwareSource.BREW), row("2", SoftwareSource.WINGET), row("3", SoftwareSource.WINGET)));
        catalogSetsVersionStatus(Map.of("1", SoftwareVersionStatus.OUTDATED, "2", SoftwareVersionStatus.UP_TO_DATE,
                "3", SoftwareVersionStatus.OUTDATED));

        // execution
        SoftwareFilters filters = service.getSoftwareFilters(filter, null);

        // verifications
        assertThat(filters.getSources()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("WINGET", 1), tuple("BREW", 1));
        assertThat(filters.getVersionStatuses()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactly(tuple("OUTDATED", 2));
    }

    @Test
    void getSoftwareFilters_titlesOfSeveralSystems_osFacetCountsTitlesPerSystem() {
        // setup
        SoftwareResponse chrome = row("1", SoftwareSource.UNMANAGED);
        chrome.setFleetSource(FleetSource.PROGRAMS);
        SoftwareResponse slack = row("2", SoftwareSource.UNMANAGED);
        slack.setFleetSource(FleetSource.PROGRAMS);
        SoftwareResponse node = row("3", SoftwareSource.BREW);
        node.setFleetSource(FleetSource.HOMEBREW_PACKAGES);
        SoftwareResponse extension = row("4", SoftwareSource.UNMANAGED);
        when(tenantSoftwareReadModelQuery.allTitles(TENANT, null, null, null))
                .thenReturn(List.of(chrome, slack, node, extension));

        // execution
        SoftwareFilters filters = service.getSoftwareFilters(null, null);

        // verifications
        assertThat(filters.getOsTypes()).extracting(SoftwareFilterOption::getValue, SoftwareFilterOption::getCount)
                .containsExactlyInAnyOrder(tuple("WINDOWS", 2), tuple("MAC_OS", 1));
    }

    @Test
    void listSoftware_versionStatusesFilter_everyTitleOfTheOtherFiltersNarrowedSortedAndPaged() {
        // setup
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setVersionStatuses(List.of(SoftwareVersionStatus.UP_TO_DATE));
        filter.setSources(List.of(SoftwareSource.BREW));
        SoftwareResponse jq = named("1", "jq");
        SoftwareResponse curl = named("2", "curl");
        SoftwareResponse git = named("3", "Git");
        SoftwareResponse xz = named("4", "xz");
        when(tenantSoftwareReadModelQuery.allTitles(TENANT, "x", null, filter)).thenReturn(List.of(jq, curl, git, xz));
        catalogSetsVersionStatus(Map.of("1", SoftwareVersionStatus.UP_TO_DATE, "2", SoftwareVersionStatus.OUTDATED,
                "3", SoftwareVersionStatus.UP_TO_DATE, "4", SoftwareVersionStatus.UP_TO_DATE));

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware("x", 0, 2, null, null, filter);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getName).containsExactly("Git", "jq");
        assertThat(result.filteredCount()).isEqualTo(3);
        assertThat(result.hasNext()).isTrue();
        verify(tenantSoftwareReadModelQuery, never()).listSoftware(any(), any(), anyInt(), any(), any(), any(), any());
        verifyPoliciesThenCatalog();
    }

    @Test
    void listSoftware_versionStatusesFilterSortedByDevicesCountDescending_inMemoryOrder() {
        // setup
        SoftwareFilterInput filter = new SoftwareFilterInput();
        filter.setVersionStatuses(List.of(SoftwareVersionStatus.OUTDATED));
        SoftwareResponse few = named("1", "few");
        few.setDevicesCount(1);
        SoftwareResponse many = named("2", "many");
        many.setDevicesCount(9);
        when(tenantSoftwareReadModelQuery.allTitles(TENANT, null, null, filter)).thenReturn(List.of(few, many));
        catalogSetsVersionStatus(Map.of("1", SoftwareVersionStatus.OUTDATED, "2", SoftwareVersionStatus.OUTDATED));
        SortInput sort = new SortInput();
        sort.setField("devicesCount");
        sort.setDirection(SortDirection.DESC);

        // execution
        PageResult<SoftwareResponse> result = service.listSoftware(null, 0, 20, sort, null, filter);

        // verifications
        assertThat(result.items()).extracting(SoftwareResponse::getName).containsExactly("many", "few");
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
        order.verify(catalogStatus).applyOnDevice(eq("m1"), anyList(), anySet());
        verifyNoInteractions(deviceHostInventoryLoader, deviceCountEnricher);
    }

    @Test
    void getDeviceSoftwareFilters_policiesThenCatalog() {
        when(deviceSoftwareReadModelQuery.rowsForDevice(TENANT, "m1", "s")).thenReturn(List.of(row("1", SoftwareSource.BREW)));

        service.getDeviceSoftwareFilters("m1", "s");

        InOrder order = inOrder(autoUpdateService, catalogStatus);
        order.verify(autoUpdateService).applyToSoftwareOnDevice(eq("m1"), anyList());
        order.verify(catalogStatus).applyOnDevice(eq("m1"), anyList(), anySet());
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
    void listDevicesForSoftware_deviceWhereBrewInstalledTheAdoptionCask_installedByBrewAndAutoUpdateOff() {
        // setup
        SoftwareResponse hiddenBar = row("7", SoftwareSource.UNMANAGED);
        hiddenBar.setAdoptionPackage(HIDDENBAR_CASK);
        List<String> machineIds = List.of("m1", "m2");
        when(tenantSoftwareReadModelQuery.exists(TENANT, "7")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "7")).thenReturn(hiddenBar);
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "7", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2")));
        when(deviceSoftwareReadModelQuery.caskTokensByMachineId(TENANT, machineIds))
                .thenReturn(Map.of("m1", Set.of("hiddenbar")));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("7", null, null, 0, 20, null);

        // verifications
        assertThat(result.items())
                .extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getInstalledBy,
                        SoftwareOnDeviceResponse::getAutoUpdate)
                .containsExactly(tuple("m1", SoftwareSource.BREW, SoftwareAutoUpdateStatus.OFF),
                        tuple("m2", null, null));
    }

    @Test
    void listDevicesForSoftware_titleWithoutAnAdoptionCask_noCaskLookedUp() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "8")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "8")).thenReturn(row("8", SoftwareSource.UNMANAGED));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "8", null, null))
                .thenReturn(List.of(onDevice("m1")));

        // execution
        service.listDevicesForSoftware("8", null, null, 0, 20, null);

        // verifications
        verify(deviceSoftwareReadModelQuery, never()).caskTokensByMachineId(TENANT, List.of("m1"));
    }

    @Test
    void listSoftwareForDevice_everyCaskOfTheDeviceGoesToTheCatalog_whateverTheSearch() {
        // setup
        List<String> machineIds = List.of("m1");
        when(deviceSoftwareReadModelQuery.rowsForDevice(TENANT, "m1", "Hidden Bar"))
                .thenReturn(List.of(row("7", SoftwareSource.UNMANAGED)));
        when(deviceSoftwareReadModelQuery.caskTokensByMachineId(TENANT, machineIds))
                .thenReturn(Map.of("m1", Set.of("hiddenbar")));

        // execution
        service.listSoftwareForDevice("m1", null, "Hidden Bar", 0, 20, null);

        // verifications
        verify(catalogStatus).applyOnDevice(eq("m1"), anyList(), eq(Set.of("hiddenbar")));
    }

    @Test
    void listDevicesForSoftware_managedTitleWithoutPolicy_autoUpdateIsOff() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.BREW));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2")));
        stubPolicyOn("42", "m1");

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", null, null, 0, 20, null);

        // verifications
        assertThat(result.items())
                .extracting(row -> row.getDevice().getMachineId(), SoftwareOnDeviceResponse::getAutoUpdate)
                .containsExactly(tuple("m1", SoftwareAutoUpdateStatus.ON), tuple("m2", SoftwareAutoUpdateStatus.OFF));
    }

    @Test
    void listDevicesForSoftware_filterByOff_keepsManagedDevicesWithoutPolicy() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "42")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "42")).thenReturn(row("42", SoftwareSource.BREW));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "42", null, null))
                .thenReturn(List.of(onDevice("m1"), onDevice("m2")));
        stubPolicyOn("42", "m1");
        SoftwareOnDeviceFilterInput filter = new SoftwareOnDeviceFilterInput();
        filter.setAutoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.OFF));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("42", filter, null, 0, 20, null);

        // verifications
        assertThat(result.items()).extracting(row -> row.getDevice().getMachineId()).containsExactly("m2");
    }

    @Test
    void listDevicesForSoftware_unmanagedTitleWithoutPolicy_autoUpdateStaysNull() {
        // setup
        when(tenantSoftwareReadModelQuery.exists(TENANT, "8")).thenReturn(true);
        when(tenantSoftwareReadModelQuery.get(TENANT, "8")).thenReturn(row("8", SoftwareSource.UNMANAGED));
        when(tenantSoftwareReadModelQuery.devicesForSoftwareRows(TENANT, "8", null, null))
                .thenReturn(List.of(onDevice("m1")));

        // execution
        PageResult<SoftwareOnDeviceResponse> result = service.listDevicesForSoftware("8", null, null, 0, 20, null);

        // verifications
        assertThat(result.items()).extracting(SoftwareOnDeviceResponse::getAutoUpdate).containsOnlyNulls();
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
