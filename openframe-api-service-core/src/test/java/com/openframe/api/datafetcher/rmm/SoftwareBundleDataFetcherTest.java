package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.AvailableDeviceEdge;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.api.service.rmm.software.SoftwareInventoryService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareBundleDataFetcherTest {

    private static final String ACTING_USER_ID = "user-1";
    private static final String SOFTWARE_ID = "42";
    private static final String RAW_BUNDLE_ID = "bundle-1";
    private static final String ASSIGNED_MACHINE_ID = "m1";
    private static final String OTHER_MACHINE_ID = "m2";
    private static final String SEARCH = "mac";
    private static final int PAGE_SIZE = 20;
    private static final List<PackageManagerType> ENABLED_MANAGERS = List.of(PackageManagerType.BREW);
    private static final Set<String> ASSIGNED_MACHINE_IDS = Set.of(ASSIGNED_MACHINE_ID);
    private static final int LAST = 5;
    private static final String ROW_ID = "65f1a2b3c4d5e6f708192a3b";
    private static final String ASSIGNED_ROW = "65f1a2b3c4d5e6f708192a01";
    private static final String OTHER_ROW = "65f1a2b3c4d5e6f708192a02";
    private static final SortInput BY_HOSTNAME = SortInput.builder()
            .field("hostname").direction(SortDirection.DESC).build();

    @Mock private SoftwareBundleService softwareBundleService;
    @Mock private SoftwareInventoryService softwareInventoryService;
    @Mock private DeviceService deviceService;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private DgsDataFetchingEnvironment dfe;
    @Spy private GraphQLDeviceMapper deviceMapper = new GraphQLDeviceMapper();
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private SoftwareBundleDataFetcher dataFetcher;

    private SoftwareBundleResponse bundle;
    private DeviceFilterCriteria manageableDevices;
    private CursorPaginationCriteria firstPage;
    private String bundleGlobalId;

    @BeforeEach
    void setUp() {
        bundle = SoftwareBundleResponse.builder().id(RAW_BUNDLE_ID).machineIds(List.of(ASSIGNED_MACHINE_ID)).build();
        manageableDevices = DeviceFilterCriteria.builder().manageableByPackageManagers(ENABLED_MANAGERS).build();
        ConnectionArgs firstPageArgs = ConnectionArgs.builder().first(PAGE_SIZE).build();
        firstPage = CursorPaginationCriteria.fromConnectionArgs(firstPageArgs);
        bundleGlobalId = relayIdCodec.encode(NodeType.SOFTWARE_BUNDLE, RAW_BUNDLE_ID);
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", ACTING_USER_ID)
                .build();
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, AuthorityUtils.NO_AUTHORITIES);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void assignedDevices_lastAndBefore_theAssignedDeviceQueryGetsTheBackwardPage() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-c", ROW_ID);
        String before = cursor.encode();
        ConnectionArgs lastBefore = ConnectionArgs.builder().last(LAST).before(before).build();
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.fromConnectionArgs(lastBefore);
        DeviceFilterCriteria noFilter = deviceMapper.toDeviceFilterCriteria(null);
        List<String> assigned = List.of(ASSIGNED_MACHINE_ID);
        CountedGenericQueryResult<Machine> page = page(machine(ASSIGNED_MACHINE_ID));
        when(dfe.getSource()).thenReturn(bundle);
        when(deviceService.queryAssignedDevices(assigned, noFilter, backwardPage, SEARCH, BY_HOSTNAME)).thenReturn(page);

        // execution
        CountedGenericConnection<GenericEdge<Machine>> result =
                dataFetcher.assignedDevices(dfe, null, PAGE_SIZE, null, LAST, before, SEARCH, BY_HOSTNAME);

        // verifications
        assertThat(result.getEdges()).extracting(edge -> edge.getNode().getMachineId()).containsExactly(ASSIGNED_MACHINE_ID);
        assertThat(backwardPage)
                .returns(true, CursorPaginationCriteria::isBackward)
                .returns(LAST, CursorPaginationCriteria::getLimit);
        assertThat(KeysetCursor.parseDecoded(backwardPage.getCursor())).isEqualTo(cursor);
    }

    @Test
    void availableDevices_lastAndBeforeWithASort_thePickerQueryGetsTheBackwardPageAndTheSortIsLeftOut() {
        // setup
        stubPicker();
        KeysetCursor cursor = new KeysetCursor("bucket", Sort.Direction.ASC, "2", ROW_ID);
        String before = cursor.encode();
        ConnectionArgs lastBefore = ConnectionArgs.builder().last(LAST).before(before).build();
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.fromConnectionArgs(lastBefore);
        String startCursor = new KeysetCursor("bucket", Sort.Direction.ASC, "0", ASSIGNED_ROW).encode();
        String endCursor = new KeysetCursor("bucket", Sort.Direction.ASC, "1", OTHER_ROW).encode();
        CountedGenericQueryResult<Machine> page = pickerPage(startCursor, endCursor);
        when(deviceService.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, manageableDevices, backwardPage,
                SEARCH)).thenReturn(page);

        // execution
        CountedGenericConnection<AvailableDeviceEdge> result =
                dataFetcher.availableDevices(dfe, null, PAGE_SIZE, null, LAST, before, SEARCH, BY_HOSTNAME, null);

        // verifications
        assertThat(result.getPageInfo())
                .returns(startCursor, PageInfo::getStartCursor)
                .returns(endCursor, PageInfo::getEndCursor)
                .returns(true, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage);
        assertThat(backwardPage.isBackward()).isTrue();
        assertThat(KeysetCursor.parseDecoded(backwardPage.getCursor())).isEqualTo(cursor);
        verify(deviceService).queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, manageableDevices,
                backwardPage, SEARCH);
        verifyNoMoreInteractions(deviceService);
    }

    @Test
    void availableDevices_softwareIdAndReadModelOn_onlyTheDevicesThatHaveTheSoftwareListed() {
        // setup
        stubPicker();
        List<String> softwareMachineIds = List.of(ASSIGNED_MACHINE_ID, OTHER_MACHINE_ID);
        CountedGenericQueryResult<Machine> page = page(machine(ASSIGNED_MACHINE_ID), machine(OTHER_MACHINE_ID));
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(true);
        when(softwareInventoryService.listMachineIdsForSoftware(SOFTWARE_ID)).thenReturn(softwareMachineIds);
        when(deviceService.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, manageableDevices, firstPage,
                SEARCH, softwareMachineIds)).thenReturn(page);

        // execution
        CountedGenericConnection<AvailableDeviceEdge> result =
                dataFetcher.availableDevices(dfe, null, PAGE_SIZE, null, null, null, SEARCH, null, SOFTWARE_ID);

        // verifications
        assertThat(result.getEdges())
                .extracting(edge -> edge.getNode().getMachineId(), AvailableDeviceEdge::isAssigned)
                .containsExactly(tuple(ASSIGNED_MACHINE_ID, true), tuple(OTHER_MACHINE_ID, false));
        assertThat(result.getFilteredCount()).isEqualTo(2);
    }

    @Test
    void availableDevices_softwareOnNoDevice_pickerNarrowedToNoDevice() {
        // setup
        stubPicker();
        List<String> noMachineIds = List.of();
        CountedGenericQueryResult<Machine> emptyPage = page();
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(true);
        when(softwareInventoryService.listMachineIdsForSoftware(SOFTWARE_ID)).thenReturn(noMachineIds);
        when(deviceService.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, manageableDevices, firstPage,
                SEARCH, noMachineIds)).thenReturn(emptyPage);

        // execution
        CountedGenericConnection<AvailableDeviceEdge> result =
                dataFetcher.availableDevices(dfe, null, PAGE_SIZE, null, null, null, SEARCH, null, SOFTWARE_ID);

        // verifications
        assertThat(result.getEdges()).isEmpty();
    }

    @Test
    void availableDevices_softwareIdAndReadModelOff_softwareIdIgnoredAndEveryDeviceListed() {
        // setup
        stubPicker();
        CountedGenericQueryResult<Machine> page = page(machine(ASSIGNED_MACHINE_ID), machine(OTHER_MACHINE_ID));
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(false);
        when(deviceService.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, manageableDevices, firstPage,
                SEARCH)).thenReturn(page);

        // execution
        CountedGenericConnection<AvailableDeviceEdge> result =
                dataFetcher.availableDevices(dfe, null, PAGE_SIZE, null, null, null, SEARCH, null, SOFTWARE_ID);

        // verifications
        assertThat(result.getEdges())
                .extracting(edge -> edge.getNode().getMachineId())
                .containsExactly(ASSIGNED_MACHINE_ID, OTHER_MACHINE_ID);
        verify(softwareInventoryService, never()).listMachineIdsForSoftware(SOFTWARE_ID);
    }

    @Test
    void availableDevices_noSoftwareId_everyDeviceListedAndInventoryNotRead() {
        // setup
        stubPicker();
        CountedGenericQueryResult<Machine> page = page(machine(ASSIGNED_MACHINE_ID), machine(OTHER_MACHINE_ID));
        when(deviceService.queryAvailableDevicesForSchedule(null, ASSIGNED_MACHINE_IDS, manageableDevices, firstPage,
                SEARCH)).thenReturn(page);

        // execution
        CountedGenericConnection<AvailableDeviceEdge> result =
                dataFetcher.availableDevices(dfe, null, PAGE_SIZE, null, null, null, SEARCH, null, null);

        // verifications
        assertThat(result.getEdges())
                .extracting(edge -> edge.getNode().getMachineId())
                .containsExactly(ASSIGNED_MACHINE_ID, OTHER_MACHINE_ID);
        verifyNoInteractions(softwareInventoryService);
    }

    @Test
    void availableDeviceFilters_softwareIdAndReadModelOn_countedOverTheDevicesThatHaveTheSoftware() {
        // setup
        List<String> softwareMachineIds = List.of(OTHER_MACHINE_ID);
        DeviceFilters filters = DeviceFilters.builder().filteredCount(1).build();
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(true);
        when(softwareInventoryService.listMachineIdsForSoftware(SOFTWARE_ID)).thenReturn(softwareMachineIds);
        when(deviceService.getAvailableDeviceFilters(null, manageableDevices, SEARCH, softwareMachineIds))
                .thenReturn(filters);

        // execution
        DeviceFilters result = dataFetcher.availableDeviceFilters(dfe, null, SEARCH, SOFTWARE_ID);

        // verifications
        assertThat(result).isSameAs(filters);
    }

    @Test
    void availableDeviceFilters_softwareIdAndReadModelOff_softwareIdIgnoredAndEveryDeviceCounted() {
        // setup
        DeviceFilters filters = DeviceFilters.builder().filteredCount(2).build();
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(false);
        when(deviceService.getAvailableDeviceFilters(null, manageableDevices, SEARCH)).thenReturn(filters);

        // execution
        DeviceFilters result = dataFetcher.availableDeviceFilters(dfe, null, SEARCH, SOFTWARE_ID);

        // verifications
        assertThat(result).isSameAs(filters);
        verify(softwareInventoryService, never()).listMachineIdsForSoftware(SOFTWARE_ID);
    }

    @Test
    void availableDeviceFilters_noSoftwareId_everyDeviceCountedAndInventoryNotRead() {
        // setup
        DeviceFilters filters = DeviceFilters.builder().filteredCount(2).build();
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(deviceService.getAvailableDeviceFilters(null, manageableDevices, SEARCH)).thenReturn(filters);

        // execution
        DeviceFilters result = dataFetcher.availableDeviceFilters(dfe, null, SEARCH, null);

        // verifications
        assertThat(result).isSameAs(filters);
        verifyNoInteractions(softwareInventoryService);
    }

    @Test
    void addAllDevicesToSoftwareBundle_softwareIdAndReadModelOn_onlyTheDevicesThatHaveTheSoftwareAdded() {
        // setup
        List<String> softwareMachineIds = List.of(ASSIGNED_MACHINE_ID, OTHER_MACHINE_ID);
        List<String> matchingMachineIds = List.of(OTHER_MACHINE_ID);
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(true);
        when(softwareInventoryService.listMachineIdsForSoftware(SOFTWARE_ID)).thenReturn(softwareMachineIds);
        when(deviceService.findAllDeviceIds(manageableDevices, SEARCH, softwareMachineIds))
                .thenReturn(matchingMachineIds);
        when(softwareBundleService.addDevices(RAW_BUNDLE_ID, matchingMachineIds, ACTING_USER_ID)).thenReturn(bundle);

        // execution
        SoftwareBundleResponse result =
                dataFetcher.addAllDevicesToSoftwareBundle(bundleGlobalId, null, SEARCH, SOFTWARE_ID);

        // verifications
        assertThat(result).isSameAs(bundle);
    }

    @Test
    void addAllDevicesToSoftwareBundle_softwareOnNoDevice_nothingAdded() {
        // setup
        List<String> noMachineIds = List.of();
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(true);
        when(softwareInventoryService.listMachineIdsForSoftware(SOFTWARE_ID)).thenReturn(noMachineIds);
        when(deviceService.findAllDeviceIds(manageableDevices, SEARCH, noMachineIds)).thenReturn(noMachineIds);
        when(softwareBundleService.addDevices(RAW_BUNDLE_ID, noMachineIds, ACTING_USER_ID)).thenReturn(bundle);

        // execution
        SoftwareBundleResponse result =
                dataFetcher.addAllDevicesToSoftwareBundle(bundleGlobalId, null, SEARCH, SOFTWARE_ID);

        // verifications
        assertThat(result).isSameAs(bundle);
    }

    @Test
    void addAllDevicesToSoftwareBundle_softwareIdAndReadModelOff_softwareIdIgnoredAndEveryMatchingDeviceAdded() {
        // setup
        List<String> matchingMachineIds = List.of(ASSIGNED_MACHINE_ID, OTHER_MACHINE_ID);
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(softwareInventoryService.isSoftwareReadModelEnabled()).thenReturn(false);
        when(deviceService.findAllDeviceIds(manageableDevices, SEARCH)).thenReturn(matchingMachineIds);
        when(softwareBundleService.addDevices(RAW_BUNDLE_ID, matchingMachineIds, ACTING_USER_ID)).thenReturn(bundle);

        // execution
        SoftwareBundleResponse result =
                dataFetcher.addAllDevicesToSoftwareBundle(bundleGlobalId, null, SEARCH, SOFTWARE_ID);

        // verifications
        assertThat(result).isSameAs(bundle);
        verify(softwareInventoryService, never()).listMachineIdsForSoftware(SOFTWARE_ID);
    }

    @Test
    void addAllDevicesToSoftwareBundle_noSoftwareId_everyMatchingDeviceAddedAndInventoryNotRead() {
        // setup
        List<String> matchingMachineIds = List.of(ASSIGNED_MACHINE_ID, OTHER_MACHINE_ID);
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
        when(deviceService.findAllDeviceIds(manageableDevices, SEARCH)).thenReturn(matchingMachineIds);
        when(softwareBundleService.addDevices(RAW_BUNDLE_ID, matchingMachineIds, ACTING_USER_ID)).thenReturn(bundle);

        // execution
        SoftwareBundleResponse result = dataFetcher.addAllDevicesToSoftwareBundle(bundleGlobalId, null, SEARCH, null);

        // verifications
        assertThat(result).isSameAs(bundle);
        verifyNoInteractions(softwareInventoryService);
    }

    private void stubPicker() {
        when(dfe.getSource()).thenReturn(bundle);
        when(packageManagerAvailability.enabledManagers()).thenReturn(ENABLED_MANAGERS);
    }

    private static CountedGenericQueryResult<Machine> page(Machine... machines) {
        return CountedGenericQueryResult.<Machine>builder()
                .items(List.of(machines))
                .filteredCount(machines.length)
                .build();
    }

    private static CountedGenericQueryResult<Machine> pickerPage(String startCursor, String endCursor) {
        Machine assigned = machine(ASSIGNED_MACHINE_ID);
        assigned.setId(ASSIGNED_ROW);
        Machine other = machine(OTHER_MACHINE_ID);
        other.setId(OTHER_ROW);
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).hasPreviousPage(false)
                .startCursor(startCursor).endCursor(endCursor).build();
        return CountedGenericQueryResult.<Machine>builder()
                .items(List.of(assigned, other))
                .pageInfo(pageInfo)
                .filteredCount(2)
                .build();
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setId(machineId);
        machine.setMachineId(machineId);
        return machine;
    }
}
