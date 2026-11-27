package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Limit;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsUpdateRolloutRepositoriesIT extends BaseMongoIntegrationTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String OTHER_TENANT_ID = "tenant-2";
    // machine-4 has no customer
    private static final Map<String, String> ORGANIZATION_ID_BY_MACHINE_ID = Map.of(
            "machine-1", "org-1", "machine-2", "org-1", "machine-3", "org-2", "machine-5", "org-1",
            "machine-9", "org-9");
    private static final Instant CREATED_AT = Instant.parse("2026-10-01T00:00:00Z");

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private DeviceOsStateRepository deviceOsStateRepository;
    @Autowired private OsUpdatePolicyRepository osUpdatePolicyRepository;
    @Autowired private OsUpdateOverrideRepository osUpdateOverrideRepository;
    @Autowired private DeviceOsUpdateRolloutStateRepository deviceOsUpdateRolloutStateRepository;
    @Autowired private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Autowired private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;

    @BeforeEach
    void setUp() {
        MongoPersistentEntityIndexResolver indexResolver =
                new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext());
        Stream.of(DeviceOsState.class, OsUpdatePolicy.class, OsUpdateOverride.class,
                        DeviceOsUpdateRolloutState.class)
                .forEach(document -> indexResolver.resolveIndexFor(document)
                        .forEach(mongoTemplate.indexOps(document)::createIndex));
        deviceOsStateRepository.deleteAll();
        osUpdatePolicyRepository.deleteAll();
        osUpdateOverrideRepository.deleteAll();
        deviceOsUpdateRolloutStateRepository.deleteAll();
        deviceOsPendingUpdateRepository.deleteAll();
        deviceOsUpdateHistoryRepository.deleteAll();
        mongoTemplate.remove(new Query(), Machine.class);
    }

    @Test
    void findDevicePage_devicesOfTwoPlatformsAndTwoTenants_windowsOfTheTenantAfterTheGivenMachineInItsOrder() {
        // setup
        deviceOsStateRepository.saveAll(List.of(
                deviceOsState(TENANT_ID, "machine-3", OsPlatform.WINDOWS),
                deviceOsState(TENANT_ID, "machine-1", OsPlatform.WINDOWS),
                deviceOsState(TENANT_ID, "machine-2", OsPlatform.MACOS),
                deviceOsState(TENANT_ID, "machine-4", OsPlatform.WINDOWS),
                deviceOsState(OTHER_TENANT_ID, "machine-5", OsPlatform.WINDOWS)));

        // execution
        List<DeviceOsState> firstPage =
                deviceOsStateRepository.findDevicePage(TENANT_ID, OsPlatform.WINDOWS, "", Limit.of(2));
        List<DeviceOsState> secondPage =
                deviceOsStateRepository.findDevicePage(TENANT_ID, OsPlatform.WINDOWS, "machine-3", Limit.of(2));

        // verifications
        assertThat(firstPage).extracting(DeviceOsState::getMachineId).containsExactly("machine-1", "machine-3");
        assertThat(secondPage).extracting(DeviceOsState::getMachineId).containsExactly("machine-4");
        assertThat(deviceOsStateRepository.findByTenantIdAndPlatformAndMachineIdIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("machine-1", "machine-2", "machine-5")))
                .extracting(DeviceOsState::getMachineId).containsExactly("machine-1");
    }

    @Test
    void findPolicies_policiesOfTwoTenants_theTenantsOnesTheEarliestCreatedFirst() {
        // setup
        osUpdatePolicyRepository.saveAll(List.of(
                policy(TENANT_ID, "later", CREATED_AT.plusSeconds(60)),
                policy(TENANT_ID, "earlier", CREATED_AT),
                policy(OTHER_TENANT_ID, "foreign", CREATED_AT)));
        String foreignId = osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(OTHER_TENANT_ID).getFirst().getId();

        // execution
        List<OsUpdatePolicy> found = osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(TENANT_ID);

        // verifications
        assertThat(found).extracting(OsUpdatePolicy::getName).containsExactly("earlier", "later");
        assertThat(osUpdatePolicyRepository.findByTenantIdAndId(TENANT_ID, found.getFirst().getId())).isPresent();
        assertThat(osUpdatePolicyRepository.findByTenantIdAndId(TENANT_ID, foreignId)).isEmpty();
    }

    @Test
    void saveOverride_secondOneOfTheSameScope_refusedByTheUniqueIndex() {
        // setup
        osUpdateOverrideRepository.save(override("kb-1", "org-1", null));
        osUpdateOverrideRepository.save(override("kb-1", "org-2", null));
        osUpdateOverrideRepository.save(override("kb-1", null, "machine-1"));
        osUpdateOverrideRepository.save(override("kb-1", null, null));
        osUpdateOverrideRepository.save(override("kb-2", null, null));

        // execution, verifications
        assertThrows(DuplicateKeyException.class, () -> osUpdateOverrideRepository.save(override("kb-1", "org-1", null)));
        assertThrows(DuplicateKeyException.class, () -> osUpdateOverrideRepository.save(override("kb-1", null, null)));
        assertThat(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, "kb-1")).hasSize(4);
        assertThat(osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).hasSize(5);
    }

    @Test
    void deleteOverridesOfDevice_overridesOfTwoDevicesACustomerAndAnotherTenant_onlyTheOnesOfThatDevice() {
        // setup
        OsUpdateOverride ofOtherTenant = override("kb-1", null, "machine-1");
        ofOtherTenant.setTenantId(OTHER_TENANT_ID);
        osUpdateOverrideRepository.saveAll(List.of(override("kb-1", null, "machine-1"),
                override("kb-2", null, "machine-1"), override("kb-1", null, "machine-2"),
                override("kb-1", "org-1", null), ofOtherTenant));

        // execution
        long deleted = osUpdateOverrideRepository.deleteByTenantIdAndMachineId(TENANT_ID, "machine-1");

        // verifications
        assertThat(deleted).isEqualTo(2);
        assertThat(osUpdateOverrideRepository.findAll()).hasSize(3);
    }

    @Test
    void findPoliciesNamingDevice_devicePoliciesOfTwoTenants_theTenantsOnesThatNameTheDevice() {
        // setup
        osUpdatePolicyRepository.saveAll(List.of(
                devicePolicy(TENANT_ID, "Servers", List.of("machine-1", "machine-2")),
                devicePolicy(TENANT_ID, "Kiosks", List.of("machine-3")),
                policy(TENANT_ID, "Default", CREATED_AT),
                devicePolicy(OTHER_TENANT_ID, "Other", List.of("machine-1"))));

        // execution, verifications
        assertThat(osUpdatePolicyRepository.findByTenantIdAndTargetMachineIdsContaining(TENANT_ID, "machine-1"))
                .extracting(OsUpdatePolicy::getName)
                .containsExactly("Servers");
    }

    @Test
    void rolloutStates_oneRowPerDeviceAndUpdate_readAndDeletedByDevice() {
        // setup
        deviceOsUpdateRolloutStateRepository.saveAll(List.of(
                rolloutState(TENANT_ID, "machine-1", "kb-1"),
                rolloutState(TENANT_ID, "machine-1", "kb-2"),
                rolloutState(TENANT_ID, "machine-2", "kb-1"),
                rolloutState(OTHER_TENANT_ID, "machine-1", "kb-1")));

        // execution, verifications
        assertThrows(DuplicateKeyException.class,
                () -> deviceOsUpdateRolloutStateRepository.save(rolloutState(TENANT_ID, "machine-1", "kb-1")));
        assertThat(deviceOsUpdateRolloutStateRepository.findByTenantIdAndMachineId(TENANT_ID, "machine-1")).hasSize(2);
        assertThat(deviceOsUpdateRolloutStateRepository.findByTenantIdAndMachineIdIn(
                TENANT_ID, List.of("machine-1", "machine-2"))).hasSize(3);
        assertThat(deviceOsUpdateRolloutStateRepository.deleteByTenantIdAndMachineId(TENANT_ID, "machine-1")).isEqualTo(2);
        assertThat(deviceOsUpdateRolloutStateRepository.findAll()).hasSize(2);
    }

    @Test
    void countDevicesByIdentifierAndOrganization_pendingUpdatesOfTwoCustomers_devicesPerUpdateAndCustomer() {
        // setup
        saveMachines();
        deviceOsPendingUpdateRepository.saveAll(List.of(
                pendingUpdate(TENANT_ID, "machine-1", "kb-1"), pendingUpdate(TENANT_ID, "machine-2", "kb-1"),
                pendingUpdate(TENANT_ID, "machine-3", "kb-1"), pendingUpdate(TENANT_ID, "machine-3", "kb-2"),
                pendingUpdate(TENANT_ID, "machine-4", "kb-1"), pendingUpdate(TENANT_ID, "machine-5", "kb-1"),
                pendingUpdate(OTHER_TENANT_ID, "machine-9", "kb-1")));

        // execution
        List<OsUpdateOrganizationDeviceCount> ofEveryUpdate =
                deviceOsPendingUpdateRepository.countDevicesByIdentifierAndOrganization(
                        TENANT_ID, OsPlatform.WINDOWS, null, List.of("machine-5"), null);
        List<OsUpdateOrganizationDeviceCount> ofOneUpdate =
                deviceOsPendingUpdateRepository.countDevicesByIdentifierAndOrganization(
                        TENANT_ID, OsPlatform.WINDOWS, List.of("kb-2"), List.of(), null);
        List<OsUpdateOrganizationDeviceCount> ofOneDevice =
                deviceOsPendingUpdateRepository.countDevicesByIdentifierAndOrganization(
                        TENANT_ID, OsPlatform.WINDOWS, null, List.of(), List.of("machine-1"));

        // verifications
        assertThat(ofEveryUpdate).containsExactlyInAnyOrder(
                new OsUpdateOrganizationDeviceCount("kb-1", "org-1", 2),
                new OsUpdateOrganizationDeviceCount("kb-1", "org-2", 1),
                new OsUpdateOrganizationDeviceCount("kb-2", "org-2", 1));
        assertThat(ofOneUpdate).containsExactly(new OsUpdateOrganizationDeviceCount("kb-2", "org-2", 1));
        assertThat(ofOneDevice).containsExactly(new OsUpdateOrganizationDeviceCount("kb-1", "org-1", 1));
    }

    @Test
    void countInstalledDevicesByIdentifierAndOrganization_repeatedFailedAndUninstalledEntries_devicesThatInstalled() {
        // setup
        saveMachines();
        deviceOsUpdateHistoryRepository.saveAll(List.of(
                historyEntry("machine-1", "kb-1", 1, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry("machine-1", "kb-1", 2, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry("machine-2", "kb-1", 3, OsUpdateOperation.INSTALL, OsUpdateInstallResult.FAILED),
                historyEntry("machine-2", "kb-2", 4, OsUpdateOperation.UNINSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry("machine-3", "kb-1", 5, OsUpdateOperation.INSTALL,
                        OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS),
                historyEntry("machine-4", "kb-1", 6, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED)));

        // execution
        List<OsUpdateOrganizationDeviceCount> ofEveryUpdate =
                deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifierAndOrganization(TENANT_ID, null, null);
        List<OsUpdateOrganizationDeviceCount> ofOneDevice =
                deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifierAndOrganization(
                        TENANT_ID, List.of("kb-1"), List.of("machine-3"));

        // verifications
        assertThat(ofEveryUpdate).containsExactlyInAnyOrder(
                new OsUpdateOrganizationDeviceCount("kb-1", "org-1", 1),
                new OsUpdateOrganizationDeviceCount("kb-1", "org-2", 1));
        assertThat(ofOneDevice).containsExactly(new OsUpdateOrganizationDeviceCount("kb-1", "org-2", 1));
    }

    @Test
    void countDevicesWithInstallDue_rowsDueAheadAndHeld_theDevicesWithADueRowOnceEach() {
        // setup
        Instant now = Instant.parse("2026-11-01T00:00:00Z");
        deviceOsUpdateRolloutStateRepository.saveAll(List.of(
                rolloutState("machine-1", "org-1", "kb-1", now.minusSeconds(60), null),
                rolloutState("machine-1", "org-1", "kb-2", now, null),
                rolloutState("machine-2", "org-1", "kb-1", now.plusSeconds(60), null),
                rolloutState("machine-3", "org-2", "kb-1", now.minusSeconds(60), null),
                rolloutState("machine-4", "org-2", "kb-1", null, null),
                rolloutState(OTHER_TENANT_ID, "machine-9", "kb-1")));

        // execution, verifications
        assertThat(deviceOsUpdateRolloutStateRepository.countDevicesWithInstallDue(TENANT_ID, List.of(), now))
                .isEqualTo(2);
        assertThat(deviceOsUpdateRolloutStateRepository.countDevicesWithInstallDue(TENANT_ID, List.of("org-1"), now))
                .isEqualTo(1);
        assertThat(deviceOsUpdateRolloutStateRepository.countDevicesWithInstallDue(TENANT_ID, List.of("org-3"), now))
                .isZero();
    }

    @Test
    void countOverdueDevices_devicesOnlineOfflineAndWithoutAHeartbeat_everyOverdueOneAndTheNotOnlineOnes() {
        // setup
        saveMachines();
        Instant now = Instant.parse("2026-11-01T00:00:00Z");
        Instant installFrom = now.minusSeconds(86400);
        deviceOsUpdateRolloutStateRepository.saveAll(List.of(
                rolloutState("machine-1", "org-1", "kb-1", installFrom, now.minusSeconds(60)),
                rolloutState("machine-1", "org-1", "kb-2", installFrom, now.minusSeconds(30)),
                rolloutState("machine-2", "org-1", "kb-1", installFrom, now.minusSeconds(60)),
                rolloutState("machine-3", "org-2", "kb-1", installFrom, now.minusSeconds(60)),
                rolloutState("machine-5", "org-1", "kb-1", installFrom, now)));

        // execution
        OsUpdateOverdueDeviceCounts ofTenant =
                deviceOsUpdateRolloutStateRepository.countOverdueDevices(TENANT_ID, List.of(), now);
        OsUpdateOverdueDeviceCounts ofCustomer =
                deviceOsUpdateRolloutStateRepository.countOverdueDevices(TENANT_ID, List.of("org-1"), now);
        OsUpdateOverdueDeviceCounts ofCustomerWithoutDevices =
                deviceOsUpdateRolloutStateRepository.countOverdueDevices(TENANT_ID, List.of("org-3"), now);

        // verifications
        assertThat(ofTenant).isEqualTo(new OsUpdateOverdueDeviceCounts(3, 2));
        assertThat(ofCustomer).isEqualTo(new OsUpdateOverdueDeviceCounts(2, 1));
        assertThat(ofCustomerWithoutDevices).isEqualTo(new OsUpdateOverdueDeviceCounts(0, 0));
    }

    @Test
    void countManageableDevices_windowsDevicesOfTheTenantWeCanManage_allOfThemAndTheOnesWaitingForARestart() {
        // setup
        deviceOsStateRepository.saveAll(List.of(
                deviceOsState("machine-1", OsPlatform.WINDOWS, OsUpdateManageabilityState.MANAGEABLE,
                        OsRebootPending.YES),
                deviceOsState("machine-2", OsPlatform.WINDOWS, OsUpdateManageabilityState.MANAGEABLE,
                        OsRebootPending.NO),
                deviceOsState("machine-3", OsPlatform.WINDOWS, OsUpdateManageabilityState.NOT_MANAGEABLE,
                        OsRebootPending.YES),
                deviceOsState("machine-4", OsPlatform.MACOS, OsUpdateManageabilityState.MANAGEABLE,
                        OsRebootPending.YES),
                deviceOsState(OTHER_TENANT_ID, "machine-9", OsPlatform.WINDOWS)));

        // execution
        ManageableOsDeviceCounts ofTenant =
                deviceOsStateRepository.countManageableDevices(TENANT_ID, OsPlatform.WINDOWS, null);
        ManageableOsDeviceCounts ofOneDevice =
                deviceOsStateRepository.countManageableDevices(TENANT_ID, OsPlatform.WINDOWS, List.of("machine-2"));
        ManageableOsDeviceCounts ofNoDevice =
                deviceOsStateRepository.countManageableDevices(TENANT_ID, OsPlatform.WINDOWS, List.of());

        // verifications
        assertThat(ofTenant).isEqualTo(new ManageableOsDeviceCounts(2, 1));
        assertThat(ofOneDevice).isEqualTo(new ManageableOsDeviceCounts(1, 0));
        assertThat(ofNoDevice).isEqualTo(new ManageableOsDeviceCounts(0, 0));
    }

    // machine-1 and machine-2 of org-1, online and offline; machine-3 of org-2, no heartbeat yet; machine-4 without
    // a customer; machine-5 of org-1; machine-9 of the other tenant.
    private void saveMachines() {
        mongoTemplate.insertAll(List.of(
                machine(TENANT_ID, "machine-1", TelemetryStatus.ONLINE),
                machine(TENANT_ID, "machine-2", TelemetryStatus.OFFLINE),
                machine(TENANT_ID, "machine-3", null),
                machine(TENANT_ID, "machine-4", TelemetryStatus.ONLINE),
                machine(TENANT_ID, "machine-5", TelemetryStatus.ONLINE),
                machine(OTHER_TENANT_ID, "machine-9", TelemetryStatus.ONLINE)));
    }

    private static Machine machine(String tenantId, String machineId, TelemetryStatus telemetryStatus) {
        Machine machine = new Machine();
        machine.setTenantId(tenantId);
        machine.setMachineId(machineId);
        machine.setOrganizationId(ORGANIZATION_ID_BY_MACHINE_ID.get(machineId));
        machine.setTelemetryStatus(telemetryStatus);
        return machine;
    }

    private static DeviceOsPendingUpdate pendingUpdate(String tenantId, String machineId, String identifier) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(tenantId).machineId(machineId).organizationId(ORGANIZATION_ID_BY_MACHINE_ID.get(machineId))
                .platform(OsPlatform.WINDOWS).identifier(identifier)
                .build();
    }

    private static DeviceOsUpdateHistoryEntry historyEntry(String machineId, String identifier, int number,
                                                           OsUpdateOperation operation,
                                                           OsUpdateInstallResult result) {
        return DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID).machineId(machineId).organizationId(ORGANIZATION_ID_BY_MACHINE_ID.get(machineId))
                .entryKey("entry-" + number).identifier(identifier)
                .installedAt(CREATED_AT.plusSeconds(number)).operation(operation).result(result)
                .build();
    }

    private static DeviceOsState deviceOsState(String machineId, OsPlatform platform,
                                               OsUpdateManageabilityState manageabilityState,
                                               OsRebootPending rebootPending) {
        return DeviceOsState.builder()
                .tenantId(TENANT_ID).machineId(machineId).platform(platform)
                .manageability(OsUpdateManageability.builder().state(manageabilityState).build())
                .rebootPending(rebootPending)
                .build();
    }

    private static DeviceOsUpdateRolloutState rolloutState(String machineId, String organizationId,
                                                           String identifier, Instant installFrom, Instant hardAt) {
        return DeviceOsUpdateRolloutState.builder()
                .tenantId(TENANT_ID).machineId(machineId).organizationId(organizationId)
                .platform(OsPlatform.WINDOWS).identifier(identifier).policyId("policy-1")
                .installFrom(installFrom).hardAt(hardAt)
                .build();
    }

    private static DeviceOsState deviceOsState(String tenantId, String machineId, OsPlatform platform) {
        return DeviceOsState.builder().tenantId(tenantId).machineId(machineId).platform(platform).build();
    }

    private static OsUpdatePolicy policy(String tenantId, String name, Instant createdAt) {
        return OsUpdatePolicy.builder().tenantId(tenantId).name(name).createdAt(createdAt).build();
    }

    private static OsUpdatePolicy devicePolicy(String tenantId, String name, List<String> machineIds) {
        return OsUpdatePolicy.builder()
                .tenantId(tenantId).name(name).createdAt(CREATED_AT)
                .target(OsUpdatePolicyTarget.builder()
                        .type(OsUpdatePolicyTargetType.DEVICE).machineIds(machineIds).build())
                .build();
    }

    private static OsUpdateOverride override(String identifier, String organizationId, String machineId) {
        return OsUpdateOverride.builder()
                .tenantId(TENANT_ID).platform(OsPlatform.WINDOWS).identifier(identifier)
                .organizationId(organizationId).machineId(machineId).action(OsUpdateOverrideAction.HOLD)
                .build();
    }

    private static DeviceOsUpdateRolloutState rolloutState(String tenantId, String machineId, String identifier) {
        return DeviceOsUpdateRolloutState.builder()
                .tenantId(tenantId).machineId(machineId).platform(OsPlatform.WINDOWS).identifier(identifier)
                .policyId("policy-1")
                .build();
    }
}
