package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRolloutStateRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Limit;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeviceOsUpdateRolloutStateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final Instant PUBLISHED_AT = Instant.parse("2026-10-13T17:00:00Z");
    private static final Instant DISCOVERED_AT = Instant.parse("2026-10-13T20:00:00Z");

    @Mock
    private TenantIdProvider tenantIdProvider;
    @Mock
    private DeviceOsStateRepository deviceOsStateRepository;
    @Mock
    private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Mock
    private DeviceOsUpdateRolloutStateRepository deviceOsUpdateRolloutStateRepository;
    @Mock
    private OsUpdateRepository osUpdateRepository;
    @Mock
    private OsUpdatePolicyRepository osUpdatePolicyRepository;
    @Mock
    private OsUpdateOverrideRepository osUpdateOverrideRepository;
    @Mock
    private MachineRepository machineRepository;
    @Mock
    private TagAssignmentRepository tagAssignmentRepository;
    @Captor
    private ArgumentCaptor<List<DeviceOsUpdateRolloutState>> savedRolloutStates;
    @Captor
    private ArgumentCaptor<Iterable<DeviceOsUpdateRolloutState>> deletedRolloutStates;

    private DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;
    private OsUpdatePolicy osUpdatePolicy;

    @BeforeEach
    void setUp() {
        deviceOsUpdateRolloutStateService = new DeviceOsUpdateRolloutStateService(
                tenantIdProvider, deviceOsStateRepository, deviceOsPendingUpdateRepository,
                deviceOsUpdateRolloutStateRepository, osUpdateRepository, osUpdatePolicyRepository,
                osUpdateOverrideRepository, machineRepository, tagAssignmentRepository,
                new OsUpdatePolicyResolver(), new OsUpdateOverrideResolver(),
                new DeviceOsUpdateRolloutStateCalculator(
                        new OsUpdateUrgencyResolver(),
                        new OsUpdateRolloutStrategyResolver(List.of(new PilotThenEveryoneRolloutStrategy(),
                                new EveryoneAtOnceRolloutStrategy(), new HoldRolloutStrategy())),
                        new OsUpdateRestartDeadlineCalculator()));
        osUpdatePolicy = OsUpdatePolicy.builder()
                .id("policy-1")
                .target(OsUpdatePolicyTarget.builder().type(OsUpdatePolicyTargetType.TENANT).build())
                .rolloutRules(Map.of(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                        .mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE)
                        .daysAfterRelease(7).daysLaterToEveryone(14).build()))
                .restartDeadlines(Map.of(OsUpdateUrgency.QUALITY, OsUpdateRestartDeadline.builder()
                        .focusDays(5).softDays(21).hardDays(30).build()))
                .pilotTagId("pilot-tag")
                .createdAt(Instant.parse("2026-10-01T00:00:00Z"))
                .build();

        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(TENANT_ID)).thenReturn(List.of(osUpdatePolicy));
        when(deviceOsStateRepository.findByTenantIdAndPlatformAndMachineIdIn(TENANT_ID, OsPlatform.WINDOWS,
                List.of("machine-1"))).thenReturn(List.of(deviceOsState("machine-1", OsUpdateManageabilityState.MANAGEABLE)));
        when(machineRepository.findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-1")))
                .thenReturn(List.of(machine("machine-1")));
        when(deviceOsPendingUpdateRepository.findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-1")))
                .thenReturn(List.of(deviceOsPendingUpdate("machine-1", "update-1")));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(TENANT_ID, OsPlatform.WINDOWS,
                Set.of("update-1"))).thenReturn(List.of(osUpdate("update-1")));
    }

    @Test
    void refreshMachines_deviceUnderAPolicyWithAPendingUpdate_savesTheCalculatedState() {
        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).saveAll(savedRolloutStates.capture());
        assertThat(savedRolloutStates.getValue()).containsExactly(rolloutState(null, "2026-11-03T17:00:00Z"));
        verify(deviceOsUpdateRolloutStateRepository).deleteAll(deletedRolloutStates.capture());
        assertThat(deletedRolloutStates.getValue()).isEmpty();
    }

    @Test
    void refreshMachines_deviceWithThePilotTagOfItsPolicy_installFromOfThePilotRing() {
        // setup
        when(tagAssignmentRepository.findByEntityIdInAndTagIdInAndEntityType(
                List.of("machine-1"), List.of("pilot-tag"), TagEntityType.DEVICE))
                .thenReturn(List.of(TagAssignment.builder().entityId("machine-1").tagId("pilot-tag").build()));

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).saveAll(savedRolloutStates.capture());
        assertThat(savedRolloutStates.getValue()).containsExactly(rolloutState(null, "2026-10-20T17:00:00Z"));
    }

    @Test
    void refreshMachines_policyWithoutAPilotTagAndDeviceWithoutTags_calculatesTheStateOfANonPilotDevice() {
        // setup
        osUpdatePolicy.setPilotTagId(null);

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).saveAll(savedRolloutStates.capture());
        assertThat(savedRolloutStates.getValue()).containsExactly(rolloutState(null, "2026-11-03T17:00:00Z"));
    }

    @Test
    void refreshMachines_storedStateEqualsTheCalculatedOne_savesNothing() {
        // setup
        when(deviceOsUpdateRolloutStateRepository.findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-1")))
                .thenReturn(List.of(rolloutState("state-1", "2026-11-03T17:00:00Z")));

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).saveAll(savedRolloutStates.capture());
        assertThat(savedRolloutStates.getValue()).isEmpty();
        verify(deviceOsUpdateRolloutStateRepository).deleteAll(deletedRolloutStates.capture());
        assertThat(deletedRolloutStates.getValue()).isEmpty();
    }

    @Test
    void refreshMachines_storedStateDiffersFromTheCalculatedOne_savesItUnderTheStoredId() {
        // setup
        when(deviceOsUpdateRolloutStateRepository.findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-1")))
                .thenReturn(List.of(rolloutState("state-1", "2026-10-20T17:00:00Z")));

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).saveAll(savedRolloutStates.capture());
        assertThat(savedRolloutStates.getValue()).containsExactly(rolloutState("state-1", "2026-11-03T17:00:00Z"));
    }

    @Test
    void refreshMachines_storedStateOfAnUpdateNoLongerPending_removesIt() {
        // setup
        DeviceOsUpdateRolloutState ofInstalledUpdate = rolloutState("state-0", "2026-09-01T00:00:00Z");
        ofInstalledUpdate.setIdentifier("update-0");
        when(deviceOsUpdateRolloutStateRepository.findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-1")))
                .thenReturn(List.of(ofInstalledUpdate));

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).deleteAll(deletedRolloutStates.capture());
        assertThat(deletedRolloutStates.getValue()).containsExactly(ofInstalledUpdate);
    }

    @Test
    void refreshMachines_deviceWeCannotManage_removesItsStoredStatesAndCalculatesNothing() {
        // setup
        DeviceOsUpdateRolloutState stored = rolloutState("state-1", "2026-11-03T17:00:00Z");
        when(deviceOsStateRepository.findByTenantIdAndPlatformAndMachineIdIn(TENANT_ID, OsPlatform.WINDOWS,
                List.of("machine-1")))
                .thenReturn(List.of(deviceOsState("machine-1", OsUpdateManageabilityState.NOT_MANAGEABLE)));
        when(deviceOsUpdateRolloutStateRepository.findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-1")))
                .thenReturn(List.of(stored));

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).deleteAll(deletedRolloutStates.capture());
        assertThat(deletedRolloutStates.getValue()).containsExactly(stored);
        verify(machineRepository, never()).findByTenantIdAndMachineIdIn(any(), anyCollection());
    }

    @Test
    void isRolloutDevice_manageableWindowsDeviceThatReportsItsOs_true() {
        // execution, verifications
        assertThat(deviceOsUpdateRolloutStateService.isRolloutDevice("machine-1")).isTrue();
    }

    @Test
    void isRolloutDevice_deviceWeCannotManage_false() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndPlatformAndMachineIdIn(TENANT_ID, OsPlatform.WINDOWS,
                List.of("machine-1")))
                .thenReturn(List.of(deviceOsState("machine-1", OsUpdateManageabilityState.NOT_MANAGEABLE)));

        // execution, verifications
        assertThat(deviceOsUpdateRolloutStateService.isRolloutDevice("machine-1")).isFalse();
    }

    @Test
    void isRolloutDevice_deviceWithoutAWindowsOsReport_false() {
        // execution, verifications
        assertThat(deviceOsUpdateRolloutStateService.isRolloutDevice("machine-mac")).isFalse();
    }

    @Test
    void refreshMachines_noPolicyCoversTheDevice_savesNothing() {
        // setup
        osUpdatePolicy.setTarget(OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-2").build());

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).saveAll(savedRolloutStates.capture());
        assertThat(savedRolloutStates.getValue()).isEmpty();
    }

    @Test
    void refreshMachines_updateHeldForTheCustomerOfTheDevice_savesTheStateWithoutInstallFrom() {
        // setup
        when(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifierIn(TENANT_ID, OsPlatform.WINDOWS,
                Set.of("update-1")))
                .thenReturn(List.of(OsUpdateOverride.builder()
                        .identifier("update-1").organizationId("org-1").action(OsUpdateOverrideAction.HOLD)
                        .actedAt(Instant.parse("2026-10-14T09:00:00Z")).build()));

        // execution
        deviceOsUpdateRolloutStateService.refreshMachines(List.of("machine-1"));

        // verifications
        verify(deviceOsUpdateRolloutStateRepository).saveAll(savedRolloutStates.capture());
        assertThat(savedRolloutStates.getValue()).singleElement().satisfies(deviceOsUpdateRolloutState -> {
            assertThat(deviceOsUpdateRolloutState.getOverrideAction()).isEqualTo(OsUpdateOverrideAction.HOLD);
            assertThat(deviceOsUpdateRolloutState.getInstallFrom()).isNull();
        });
    }

    @Test
    void refreshAll_moreDevicesThanOneBatch_readsThePagesByMachineIdUntilAShortOne() {
        // setup
        when(deviceOsStateRepository.findDevicePage(TENANT_ID, OsPlatform.WINDOWS, "", Limit.of(2)))
                .thenReturn(List.of(deviceOsState("machine-1", OsUpdateManageabilityState.NOT_MANAGEABLE),
                        deviceOsState("machine-2", OsUpdateManageabilityState.NOT_MANAGEABLE)));
        when(deviceOsStateRepository.findDevicePage(TENANT_ID, OsPlatform.WINDOWS, "machine-2", Limit.of(2)))
                .thenReturn(List.of(deviceOsState("machine-3", OsUpdateManageabilityState.NOT_MANAGEABLE)));

        // execution
        deviceOsUpdateRolloutStateService.refreshAll(2);

        // verifications
        verify(deviceOsUpdateRolloutStateRepository)
                .findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-1", "machine-2"));
        verify(deviceOsUpdateRolloutStateRepository).findByTenantIdAndMachineIdIn(TENANT_ID, List.of("machine-3"));
        verify(deviceOsStateRepository, never())
                .findDevicePage(TENANT_ID, OsPlatform.WINDOWS, "machine-3", Limit.of(2));
    }

    private static DeviceOsState deviceOsState(String machineId, OsUpdateManageabilityState manageabilityState) {
        return DeviceOsState.builder()
                .machineId(machineId)
                .platform(OsPlatform.WINDOWS)
                .manageability(OsUpdateManageability.builder().state(manageabilityState).build())
                .build();
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setOrganizationId("org-1");
        return machine;
    }

    private static DeviceOsPendingUpdate deviceOsPendingUpdate(String machineId, String identifier) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(machineId)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .discoveredAt(DISCOVERED_AT)
                .build();
    }

    private static OsUpdate osUpdate(String identifier) {
        return OsUpdate.builder()
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .classification(OsUpdateClassification.QUALITY)
                .publishedAt(PUBLISHED_AT)
                .firstSeenAt(DISCOVERED_AT)
                .build();
    }

    private static DeviceOsUpdateRolloutState rolloutState(String id, String installFrom) {
        Instant from = Instant.parse(installFrom);
        return DeviceOsUpdateRolloutState.builder()
                .id(id)
                .tenantId(TENANT_ID)
                .machineId("machine-1")
                .platform(OsPlatform.WINDOWS)
                .identifier("update-1")
                .policyId("policy-1")
                .installFrom(from)
                .focusAt(from.plusSeconds(5 * 86400))
                .softAt(from.plusSeconds(21 * 86400))
                .hardAt(from.plusSeconds(30 * 86400))
                .build();
    }
}
