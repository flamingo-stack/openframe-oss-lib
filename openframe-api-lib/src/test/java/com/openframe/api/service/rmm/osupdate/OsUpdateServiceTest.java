package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateCustomerResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRolloutRuleResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.mapper.OsUpdatePolicyResponseMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import com.openframe.data.repository.rmm.osupdate.OsUpdateIdentifiersOfPlatform;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOrganizationDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.osupdate.HoldRolloutStrategy;
import com.openframe.data.service.rmm.osupdate.OsUpdateCustomerStatusResolver;
import com.openframe.data.service.rmm.osupdate.OsUpdateOverrideResolver;
import com.openframe.data.service.rmm.osupdate.OsUpdatePolicyResolver;
import com.openframe.data.service.rmm.osupdate.OsUpdateReleasedAtResolver;
import com.openframe.data.service.rmm.osupdate.OsUpdateRolloutStrategyResolver;
import com.openframe.data.service.rmm.osupdate.OsUpdateUrgencyResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String WINDOWS_ID = "id-windows";
    private static final String OTHER_WINDOWS_ID = "id-windows-2";
    private static final String MAC_ID = "id-mac";
    private static final String WINDOWS_IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String OTHER_WINDOWS_IDENTIFIER = "0d1e2f3a-5555-4666-8777-112233445566:1";
    private static final String MAC_IDENTIFIER = "Safari-18.2";
    private static final List<String> EVERY_ORGANIZATION = List.of();
    private static final OsUpdateDeviceScope NO_DEVICE = new OsUpdateDeviceScope(List.of());
    private static final List<String> EVERY_DEVICE = null;
    private static final List<String> ORGANIZATIONS = List.of("org-1");
    private static final List<String> ORGANIZATION_MACHINE_IDS = List.of("machine-1", "machine-2");
    private static final OsUpdateDeviceScope ORGANIZATION_DEVICES = new OsUpdateDeviceScope(ORGANIZATION_MACHINE_IDS);
    private static final OsUpdateFilter FILTER = OsUpdateFilter.builder().platform(OsPlatform.WINDOWS).build();

    @Mock private OsUpdateRepository osUpdateRepository;
    @Mock private DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    @Mock private DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    @Mock private DeviceService deviceService;
    @Spy private CursorPageAssembler cursorPageAssembler = new CursorPageAssembler();
    @Mock private OsUpdateResponseMapper osUpdateResponseMapper;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private OsUpdatePolicyRepository osUpdatePolicyRepository;
    @Mock private OsUpdateOverrideRepository osUpdateOverrideRepository;
    @Spy private OsUpdateCustomerStatusResolver osUpdateCustomerStatusResolver = new OsUpdateCustomerStatusResolver(
            new OsUpdatePolicyResolver(), new OsUpdateOverrideResolver(), new OsUpdateUrgencyResolver(),
            new OsUpdateRolloutStrategyResolver(List.of(new HoldRolloutStrategy())), new OsUpdateReleasedAtResolver());
    @Spy private OsUpdatePolicyResponseMapper osUpdatePolicyResponseMapper = new OsUpdatePolicyResponseMapper();

    @InjectMocks private OsUpdateService osUpdateService;

    private OsUpdate windowsUpdate;
    private OsUpdate otherWindowsUpdate;
    private OsUpdate macUpdate;
    private OsUpdateResponse windowsResponse;
    private OsUpdateResponse otherWindowsResponse;

    @BeforeEach
    void setUp() {
        windowsUpdate = osUpdate(WINDOWS_ID, OsPlatform.WINDOWS, WINDOWS_IDENTIFIER);
        otherWindowsUpdate = osUpdate(OTHER_WINDOWS_ID, OsPlatform.WINDOWS, OTHER_WINDOWS_IDENTIFIER);
        macUpdate = osUpdate(MAC_ID, OsPlatform.MACOS, MAC_IDENTIFIER);
        windowsResponse = OsUpdateResponse.builder().id(WINDOWS_ID).cursor(CursorCodec.encode("raw-1")).build();
        otherWindowsResponse = OsUpdateResponse.builder().id(OTHER_WINDOWS_ID).cursor(CursorCodec.encode("raw-2")).build();
    }

    @Test
    void listOsUpdates_moreUpdatesThanThePage_pageOfTheLimitWithANextPageAndItsCursors() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findPage(TENANT_ID, FILTER, null, 3))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate, macUpdate));
        stubOsUpdateResponses();
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(true)
                .hasPreviousPage(false)
                .startCursor(CursorCodec.encode("raw-1"))
                .endCursor(CursorCodec.encode("raw-2"))
                .build();

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates =
                osUpdateService.listOsUpdates(FILTER, OsUpdateDeviceScope.EVERY_DEVICE, pagination);

        // verifications
        assertThat(osUpdates.getItems()).containsExactly(windowsResponse, otherWindowsResponse);
        assertThat(osUpdates.getPageInfo()).isEqualTo(expectedPageInfo);
        verifyNoInteractions(deviceService);
    }

    @ParameterizedTest
    @CsvSource({
            ",    21",
            "0,   2",
            "1,   2",
            "100, 101",
            "500, 101"
    })
    void listOsUpdates_pageSize_twentyByDefaultAndKeptBetweenOneAndAHundred(Integer first, int expectedFetch) {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(first).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findPage(TENANT_ID, FILTER, null, expectedFetch)).thenReturn(List.of());

        // execution
        osUpdateService.listOsUpdates(FILTER, OsUpdateDeviceScope.EVERY_DEVICE, pagination);

        // verifications
        verify(osUpdateRepository).findPage(TENANT_ID, FILTER, null, expectedFetch);
    }

    @Test
    void findDeviceScope_organizations_theirDevicesReadOnce() {
        // setup
        when(deviceService.findDeviceIdsOfOrganizations(ORGANIZATIONS)).thenReturn(ORGANIZATION_MACHINE_IDS);

        // execution
        OsUpdateDeviceScope osUpdateDeviceScope = osUpdateService.findDeviceScope(ORGANIZATIONS);

        // verifications
        assertThat(osUpdateDeviceScope).isEqualTo(ORGANIZATION_DEVICES);
        verify(deviceService).findDeviceIdsOfOrganizations(ORGANIZATIONS);
    }

    @Test
    void findDeviceScope_noOrganization_everyDeviceWithoutReadingThem() {
        // execution
        OsUpdateDeviceScope osUpdateDeviceScope = osUpdateService.findDeviceScope(EVERY_ORGANIZATION);

        // verifications
        assertThat(osUpdateDeviceScope).isEqualTo(OsUpdateDeviceScope.EVERY_DEVICE);
        verifyNoInteractions(deviceService);
    }

    @Test
    void listOsUpdates_organizations_onlyTheUpdatesPendingOrInstalledOnTheirDevices() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsPendingUpdateService.listIdentifiersByPlatform(ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateIdentifiersOfPlatform(OsPlatform.MACOS, List.of(MAC_IDENTIFIER))));
        when(deviceOsUpdateHistoryService.listInstalledIdentifiers(ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(WINDOWS_IDENTIFIER));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, Set.of(WINDOWS_IDENTIFIER))).thenReturn(List.of(windowsUpdate));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.MACOS, Set.of(MAC_IDENTIFIER))).thenReturn(List.of(macUpdate));
        OsUpdateFilter expectedFilter = FILTER.toBuilder().osUpdateIds(List.of(WINDOWS_ID, MAC_ID)).build();
        when(osUpdateRepository.findPage(TENANT_ID, expectedFilter, null, 3)).thenReturn(List.of());

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates = osUpdateService.listOsUpdates(FILTER, ORGANIZATION_DEVICES, pagination);

        // verifications
        assertThat(osUpdates.getItems()).isEmpty();
        verify(osUpdateRepository).findPage(TENANT_ID, expectedFilter, null, 3);
    }

    @Test
    void listOsUpdates_organizationsWithoutDevices_filterOfNoUpdate() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsPendingUpdateService.listIdentifiersByPlatform(List.of())).thenReturn(List.of());
        when(deviceOsUpdateHistoryService.listInstalledIdentifiers(List.of())).thenReturn(List.of());
        OsUpdateFilter expectedFilter = FILTER.toBuilder().osUpdateIds(List.of()).build();
        when(osUpdateRepository.findPage(TENANT_ID, expectedFilter, null, 3)).thenReturn(List.of());

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates = osUpdateService.listOsUpdates(FILTER, NO_DEVICE, pagination);

        // verifications
        assertThat(osUpdates.getItems()).isEmpty();
    }

    @Test
    void findOsUpdate_updateOfTheTenant_itsResponse() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.of(windowsUpdate));
        when(osUpdateRepository.encodeCursor(windowsUpdate)).thenReturn("raw-1");
        when(osUpdateResponseMapper.toResponse(windowsUpdate, CursorCodec.encode("raw-1"))).thenReturn(windowsResponse);

        // execution
        Optional<OsUpdateResponse> found = osUpdateService.findOsUpdate(WINDOWS_ID);

        // verifications
        assertThat(found).containsSame(windowsResponse);
    }

    @Test
    void findOsUpdate_noSuchUpdateInTheTenant_empty() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.empty());

        // execution
        Optional<OsUpdateResponse> found = osUpdateService.findOsUpdate(WINDOWS_ID);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(osUpdateResponseMapper);
    }

    @Test
    void getOsUpdate_noSuchUpdateInTheTenant_throwsOsUpdateNotFound() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.empty());

        // execution
        OsUpdateNotFoundException ex =
                assertThrows(OsUpdateNotFoundException.class, () -> osUpdateService.getOsUpdate(WINDOWS_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("OS update not found: " + WINDOWS_ID);
    }

    @Test
    void countDevices_windowsUpdates_pendingAndInstalledPerUpdate() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID, OTHER_WINDOWS_ID);
        List<String> identifiers = List.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate));
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(OsPlatform.WINDOWS, identifiers, EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 7)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(identifiers, EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 3),
                        new OsUpdateDeviceCount(OTHER_WINDOWS_IDENTIFIER, 5)));

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, OsUpdateDeviceScope.EVERY_DEVICE);

        // verifications
        assertThat(deviceCounts)
                .hasSize(2)
                .containsEntry(WINDOWS_ID, OsUpdateDeviceCounts.builder().pendingDeviceCount(7).installedDeviceCount(3).build())
                .containsEntry(OTHER_WINDOWS_ID, OsUpdateDeviceCounts.builder().installedDeviceCount(5).build());
        verifyNoInteractions(deviceService);
    }

    @Test
    void countDevices_macUpdateNextToAWindowsOne_eachCountedWithinItsPlatformAndNoMacHistoryRead() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID, MAC_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds)).thenReturn(List.of(windowsUpdate, macUpdate));
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(
                OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 1)));
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(OsPlatform.MACOS, List.of(MAC_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(MAC_IDENTIFIER, 4)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(List.of(WINDOWS_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of());

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, OsUpdateDeviceScope.EVERY_DEVICE);

        // verifications
        assertThat(deviceCounts)
                .hasSize(2)
                .containsEntry(WINDOWS_ID, OsUpdateDeviceCounts.builder().pendingDeviceCount(1).build())
                .containsEntry(MAC_ID, OsUpdateDeviceCounts.builder().pendingDeviceCount(4).build());
    }

    @Test
    void countDevices_organizations_countedOnTheirDevicesOnly() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds)).thenReturn(List.of(windowsUpdate));
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(
                OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER), ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 1)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(
                List.of(WINDOWS_IDENTIFIER), ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 2)));

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, ORGANIZATION_DEVICES);

        // verifications
        assertThat(deviceCounts).containsExactly(Map.entry(WINDOWS_ID,
                OsUpdateDeviceCounts.builder().pendingDeviceCount(1).installedDeviceCount(2).build()));
    }

    @Test
    void countDevices_noneOfTheIdsIsAnUpdateOfTheTenant_emptyAndNothingCounted() {
        // setup
        List<String> osUpdateIds = List.of("unknown");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds)).thenReturn(List.of());

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, ORGANIZATION_DEVICES);

        // verifications
        assertThat(deviceCounts).isEmpty();
        verifyNoInteractions(deviceService, deviceOsPendingUpdateService, deviceOsUpdateHistoryService);
    }

    @Test
    void listCustomers_windowsUpdateAtTwoCustomers_rowPerCustomerWithItsCountsPolicyRuleAndDecision() {
        // setup
        OsUpdatePolicy holdPolicy = stubHoldPolicyOfTheTenant();
        OsUpdateOverride approvalOfSecondCustomer = stubApprovalOfSecondCustomer(List.of(WINDOWS_IDENTIFIER));
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.of(windowsUpdate));
        when(deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-2", 4),
                        new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-1", 9)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(
                List.of(WINDOWS_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-1", 29),
                        new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-3", 2)));

        // execution
        List<OsUpdateCustomerResponse> customers = osUpdateService.listCustomers(WINDOWS_ID);

        // verifications
        OsUpdateRolloutRuleResponse holdRule = OsUpdateRolloutRuleResponse.builder()
                .urgency(OsUpdateUrgency.QUALITY).mode(OsUpdateRolloutMode.HOLD).build();
        assertThat(customers).containsExactly(
                OsUpdateCustomerResponse.builder()
                        .osUpdateId(WINDOWS_ID).organizationId("org-1").status(OsUpdateCustomerStatus.HELD)
                        .policyId(holdPolicy.getId()).policyName("Default").rolloutRule(holdRule)
                        .pendingDeviceCount(9).installedDeviceCount(29)
                        .build(),
                OsUpdateCustomerResponse.builder()
                        .osUpdateId(WINDOWS_ID).organizationId("org-2").status(OsUpdateCustomerStatus.APPROVED)
                        .policyId(holdPolicy.getId()).policyName("Default").rolloutRule(holdRule)
                        .override(osUpdatePolicyResponseMapper.toResponse(approvalOfSecondCustomer))
                        .pendingDeviceCount(4).installedDeviceCount(0)
                        .build(),
                OsUpdateCustomerResponse.builder()
                        .osUpdateId(WINDOWS_ID).organizationId("org-3").status(OsUpdateCustomerStatus.HELD)
                        .policyId(holdPolicy.getId()).policyName("Default").rolloutRule(holdRule)
                        .pendingDeviceCount(0).installedDeviceCount(2)
                        .build());
    }

    @Test
    void listCustomers_macUpdate_noCustomersAndNothingCounted() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, MAC_ID)).thenReturn(Optional.of(macUpdate));

        // execution
        List<OsUpdateCustomerResponse> customers = osUpdateService.listCustomers(MAC_ID);

        // verifications
        assertThat(customers).isEmpty();
        verifyNoInteractions(deviceOsPendingUpdateService, deviceOsUpdateHistoryService, osUpdatePolicyRepository);
    }

    @Test
    void listCustomers_noSuchUpdateInTheTenant_throwsOsUpdateNotFound() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.empty());

        // execution, verifications
        assertThrows(OsUpdateNotFoundException.class, () -> osUpdateService.listCustomers(WINDOWS_ID));
    }

    @Test
    void findCustomerStatuses_updatesOfAPage_distinctStatusesPerUpdateOverTheCustomersOfTheScope() {
        // setup
        stubHoldPolicyOfTheTenant();
        List<String> identifiers = List.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER);
        stubApprovalOfSecondCustomer(identifiers);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, List.of(WINDOWS_ID, OTHER_WINDOWS_ID, MAC_ID)))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate, macUpdate));
        when(deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                OsPlatform.WINDOWS, identifiers, ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-2", 4),
                        new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-1", 9),
                        new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-3", 1)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(
                identifiers, ORGANIZATION_MACHINE_IDS)).thenReturn(List.of());

        // execution
        Map<String, List<OsUpdateCustomerStatus>> customerStatuses = osUpdateService.findCustomerStatuses(
                List.of(WINDOWS_ID, OTHER_WINDOWS_ID, MAC_ID), ORGANIZATION_DEVICES);

        // verifications
        assertThat(customerStatuses).containsOnly(
                Map.entry(WINDOWS_ID, List.of(OsUpdateCustomerStatus.APPROVED, OsUpdateCustomerStatus.HELD)));
    }

    @Test
    void findCustomerStatuses_onlyAMacUpdate_emptyAndNothingCounted() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, List.of(MAC_ID))).thenReturn(List.of(macUpdate));

        // execution
        Map<String, List<OsUpdateCustomerStatus>> customerStatuses =
                osUpdateService.findCustomerStatuses(List.of(MAC_ID), OsUpdateDeviceScope.EVERY_DEVICE);

        // verifications
        assertThat(customerStatuses).isEmpty();
        verifyNoInteractions(deviceOsPendingUpdateService, deviceOsUpdateHistoryService);
    }

    @Test
    void countHeldOsUpdates_updatesPendingAtCustomers_theOnesHeldAtOneOfThemOnceEachAndNoHistoryRead() {
        // setup
        stubHoldPolicyOfTheTenant();
        Set<String> identifiers = Set.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER);
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(TENANT_ID, OsPlatform.WINDOWS, identifiers))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate));
        when(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER)))
                .thenReturn(List.of(OsUpdateOverride.builder()
                        .identifier(OTHER_WINDOWS_IDENTIFIER).action(OsUpdateOverrideAction.APPROVE).build()));
        when(deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                OsPlatform.WINDOWS, null, ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-1", 9),
                        new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-2", 1),
                        new OsUpdateOrganizationDeviceCount(OTHER_WINDOWS_IDENTIFIER, "org-1", 3)));

        // execution
        int heldOsUpdateCount = osUpdateService.countHeldOsUpdates(ORGANIZATION_DEVICES);

        // verifications
        assertThat(heldOsUpdateCount).isEqualTo(1);
        verifyNoInteractions(deviceOsUpdateHistoryService);
    }

    @Test
    void listOsUpdates_customerStatuses_onlyTheUpdatesWithOneOfThemAtACustomerOfTheScope() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        stubHoldPolicyOfTheTenant();
        Set<String> identifiers = Set.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER);
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(TENANT_ID, OsPlatform.WINDOWS, identifiers))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate));
        when(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER)))
                .thenReturn(List.of(OsUpdateOverride.builder()
                        .identifier(OTHER_WINDOWS_IDENTIFIER).action(OsUpdateOverrideAction.REJECT).build()));
        when(deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                OsPlatform.WINDOWS, null, ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateOrganizationDeviceCount(WINDOWS_IDENTIFIER, "org-1", 9)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(
                null, ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateOrganizationDeviceCount(OTHER_WINDOWS_IDENTIFIER, "org-1", 3)));
        OsUpdateFilter rejectedFilter = FILTER.toBuilder()
                .customerStatuses(List.of(OsUpdateCustomerStatus.REJECTED, OsUpdateCustomerStatus.PILOT)).build();
        OsUpdateFilter expectedFilter = rejectedFilter.toBuilder().osUpdateIds(List.of(OTHER_WINDOWS_ID)).build();
        when(osUpdateRepository.findPage(TENANT_ID, expectedFilter, null, 3)).thenReturn(List.of());

        // execution
        osUpdateService.listOsUpdates(rejectedFilter, ORGANIZATION_DEVICES, pagination);

        // verifications
        verify(osUpdateRepository).findPage(TENANT_ID, expectedFilter, null, 3);
        verify(deviceOsPendingUpdateService, never()).listIdentifiersByPlatform(any());
    }

    @Test
    void listOsUpdates_customerStatusesNoUpdateHas_filterOfNoUpdate() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsPendingUpdateService.countDevicesByIdentifierAndOrganization(
                OsPlatform.WINDOWS, null, EVERY_DEVICE)).thenReturn(List.of());
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(null, EVERY_DEVICE))
                .thenReturn(List.of());
        OsUpdateFilter heldFilter = FILTER.toBuilder().customerStatuses(List.of(OsUpdateCustomerStatus.HELD)).build();
        OsUpdateFilter expectedFilter = heldFilter.toBuilder().osUpdateIds(List.of()).build();
        when(osUpdateRepository.findPage(TENANT_ID, expectedFilter, null, 3)).thenReturn(List.of());

        // execution
        osUpdateService.listOsUpdates(heldFilter, OsUpdateDeviceScope.EVERY_DEVICE, pagination);

        // verifications
        verify(osUpdateRepository).findPage(TENANT_ID, expectedFilter, null, 3);
    }

    // Every quality update waits for a technician.
    private OsUpdatePolicy stubHoldPolicyOfTheTenant() {
        windowsUpdate.setClassification(OsUpdateClassification.QUALITY);
        otherWindowsUpdate.setClassification(OsUpdateClassification.QUALITY);
        OsUpdatePolicy holdPolicy = OsUpdatePolicy.builder()
                .id("policy-1").name("Default")
                .target(OsUpdatePolicyTarget.builder().type(OsUpdatePolicyTargetType.TENANT).build())
                .rolloutRules(Map.of(OsUpdateUrgency.QUALITY,
                        OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.HOLD).build()))
                .createdAt(Instant.parse("2026-10-01T00:00:00Z"))
                .build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(TENANT_ID)).thenReturn(List.of(holdPolicy));
        return holdPolicy;
    }

    private OsUpdateOverride stubApprovalOfSecondCustomer(List<String> identifiers) {
        OsUpdateOverride approvalOfSecondCustomer = OsUpdateOverride.builder()
                .identifier(WINDOWS_IDENTIFIER).organizationId("org-2").action(OsUpdateOverrideAction.APPROVE)
                .actedBy("user-1").actedAt(Instant.parse("2026-10-14T00:00:00Z"))
                .build();
        when(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, identifiers)).thenReturn(List.of(approvalOfSecondCustomer));
        return approvalOfSecondCustomer;
    }

    private void stubOsUpdateResponses() {
        when(osUpdateRepository.encodeCursor(windowsUpdate)).thenReturn("raw-1");
        when(osUpdateRepository.encodeCursor(otherWindowsUpdate)).thenReturn("raw-2");
        when(osUpdateResponseMapper.toResponse(windowsUpdate, CursorCodec.encode("raw-1"))).thenReturn(windowsResponse);
        when(osUpdateResponseMapper.toResponse(otherWindowsUpdate, CursorCodec.encode("raw-2")))
                .thenReturn(otherWindowsResponse);
    }

    private static OsUpdate osUpdate(String id, OsPlatform platform, String identifier) {
        return OsUpdate.builder().id(id).tenantId(TENANT_ID).platform(platform).identifier(identifier).build();
    }
}
