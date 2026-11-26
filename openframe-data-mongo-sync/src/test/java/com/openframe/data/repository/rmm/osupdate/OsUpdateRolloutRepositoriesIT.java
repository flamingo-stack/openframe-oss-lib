package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
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

import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsUpdateRolloutRepositoriesIT extends BaseMongoIntegrationTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String OTHER_TENANT_ID = "tenant-2";
    private static final Instant CREATED_AT = Instant.parse("2026-10-01T00:00:00Z");

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private DeviceOsStateRepository deviceOsStateRepository;
    @Autowired private OsUpdatePolicyRepository osUpdatePolicyRepository;
    @Autowired private OsUpdateOverrideRepository osUpdateOverrideRepository;
    @Autowired private DeviceOsUpdateRolloutStateRepository deviceOsUpdateRolloutStateRepository;

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

    private static DeviceOsState deviceOsState(String tenantId, String machineId, OsPlatform platform) {
        return DeviceOsState.builder().tenantId(tenantId).machineId(machineId).platform(platform).build();
    }

    private static OsUpdatePolicy policy(String tenantId, String name, Instant createdAt) {
        return OsUpdatePolicy.builder().tenantId(tenantId).name(name).createdAt(createdAt).build();
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
