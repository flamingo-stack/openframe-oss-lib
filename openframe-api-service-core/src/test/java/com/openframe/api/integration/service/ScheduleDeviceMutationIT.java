package com.openframe.api.integration.service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.api.service.rmm.schedule.ScheduleDeliveryRefresher;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.api.service.rmm.schedule.ScheduleScriptDeviceService;
import com.openframe.api.service.rmm.software.SoftwareScheduleService;
import com.openframe.api.service.rmm.software.SoftwarePackageSelectionResolver;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.service.rmm.ScheduleMutationTransaction;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptMachineAssigned;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.rmm.CustomScriptScheduleRepositoryImpl;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.osupdate.CustomDeviceOsPendingUpdateRepositoryImpl;
import com.openframe.data.repository.rmm.osupdate.CustomDeviceOsStateRepositoryImpl;
import com.openframe.data.repository.rmm.osupdate.CustomDeviceOsUpdateHistoryRepositoryImpl;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRolloutStateRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import com.openframe.data.service.rmm.software.DeviceSoftwareConnectivitySync;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.mockito.AdditionalAnswers.delegatesTo;

@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
@Execution(ExecutionMode.CONCURRENT)
class ScheduleDeviceMutationIT {

    private static final String DATABASE = "schedule_device_mutation_it_" + new ObjectId().toHexString();
    private static final String TENANT = "schedule-mutation-tenant";
    private static final String MACHINE = "schedule-mutation-device";
    private static final String ACTOR = "schedule-mutation-technician";

    private static MongoDBContainer container;
    private static MongoClient client;
    private static MongoTemplate mongoTemplate;
    private static MongoRepositoryFactory repositoryFactory;

    @BeforeAll
    static void startMongo() {
        String uri = System.getProperty("mongo.external.uri");
        if (uri == null) {
            container = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();
            container.start();
            uri = container.getConnectionString() + "/test?directConnection=true";
        }
        client = MongoClients.create(uri);
        mongoTemplate = new MongoTemplate(new SimpleMongoClientDatabaseFactory(client, DATABASE));
        repositoryFactory = new MongoRepositoryFactory(mongoTemplate);
    }

    @AfterAll
    static void stopMongo() {
        if (client != null) {
            client.getDatabase(DATABASE).drop();
            client.close();
        }
        if (container != null) {
            container.stop();
        }
    }

    @Test
    void onlyExplicitScriptTargetsAreRemovedThroughTheMongoTransaction() {
        // setup
        ScriptScheduleRepository schedules = repositoryFactory.getRepository(ScriptScheduleRepository.class,
                RepositoryFragments.just(new CustomScriptScheduleRepositoryImpl(mongoTemplate)));
        ScriptScheduleMachineAssignedRepository assignments =
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class);
        DeviceOnlineDispatchRepository dispatches = repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class);
        ScheduleScriptDeviceService service = new ScheduleScriptDeviceService(assignments, schedules,
                mock(MachineRepository.class), mock(ScheduleDeviceTargetResolver.class), () -> TENANT,
                dispatches, mock(ScheduleDeliveryRefresher.class),
                new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory()));
        ScheduleScript criteria = seedScriptSchedule(ScheduleDeviceSelectionMode.CRITERIA);
        ScheduleScript legacy = seedScriptSchedule(null);

        // execution
        List<String> removedWithEmptyList = service.removeDevices(criteria.getId(), List.of(), ACTOR);
        List<String> removedWithNullList = service.removeDevices(criteria.getId(), null, ACTOR);

        // verifications
        assertThat(removedWithEmptyList).isEmpty();
        assertThat(removedWithNullList).isEmpty();
        assertThatThrownBy(() -> service.removeDevices("missing-schedule", List.of(), ACTOR))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.removeDevices(criteria.getId(), List.of(MACHINE), ACTOR))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("selects devices by criteria");
        assertThat(assignments.findByTenantIdAndScriptScheduleId(TENANT, criteria.getId())).hasSize(1);
        assertThat(dispatches.findByTenantIdAndMachineIdAndScheduleId(TENANT, MACHINE, criteria.getId())).isPresent();

        assertThat(service.removeDevices(legacy.getId(), List.of(MACHINE, MACHINE, "missing"), ACTOR)).containsExactly(MACHINE);
        assertThat(service.removeDevices(legacy.getId(), List.of(MACHINE), ACTOR)).isEmpty();
        assertThat(assignments.findByTenantIdAndScriptScheduleId(TENANT, legacy.getId())).isEmpty();
        assertThat(dispatches.findByTenantIdAndMachineIdAndScheduleId(TENANT, MACHINE, legacy.getId())).isEmpty();
    }

    @Test
    void lateReconnectCompletionDoesNotRestoreADeletedPendingRow() {
        // setup
        SoftwareScheduleOnlineDispatchRepository reconnects =
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class);
        SoftwareScheduleOnlineDispatch pending = reconnects.save(SoftwareScheduleOnlineDispatch.builder()
                .tenantId(TENANT)
                .scheduleId("software-schedule")
                .machineId(MACHINE)
                .status(DeviceOnlineDispatchStatus.NEW)
                .build());

        // execution
        assertThat(reconnects.deleteByTenantIdAndMachineIdAndStatus(TENANT, MACHINE, DeviceOnlineDispatchStatus.NEW)).isEqualTo(1);
        assertThat(reconnects.transitionIfNew(TENANT, pending.getId(), DeviceOnlineDispatchStatus.DISPATCHED, Instant.now()))
                .isZero();

        // verifications
        assertThat(reconnects.findById(pending.getId())).isEmpty();
    }

    @Test
    void reconnectLookupMatchesOnlyTheCurrentOccurrenceRegardlessOfStatus() {
        // setup
        SoftwareScheduleOnlineDispatchRepository reconnects =
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class);
        String scheduleId = "reconnect-occurrence";
        Instant scheduledFor = Instant.parse("2026-11-24T08:00:00Z");
        reconnects.saveAll(List.of(
                SoftwareScheduleOnlineDispatch.builder().tenantId(TENANT).scheduleId(scheduleId)
                        .machineId("current-reconnect").scheduledFor(scheduledFor).status(DeviceOnlineDispatchStatus.DISPATCHED).build(),
                SoftwareScheduleOnlineDispatch.builder().tenantId(TENANT).scheduleId(scheduleId)
                        .machineId("earlier-reconnect").scheduledFor(scheduledFor.minusSeconds(60)).status(DeviceOnlineDispatchStatus.NEW).build(),
                SoftwareScheduleOnlineDispatch.builder().tenantId(TENANT).scheduleId(scheduleId)
                        .machineId("legacy-reconnect").status(DeviceOnlineDispatchStatus.NEW).build()));
        List<String> machineIds = List.of("current-reconnect", "earlier-reconnect", "legacy-reconnect");

        // execution
        List<SoftwareScheduleOnlineDispatch> current = reconnects.findByTenantIdAndMachineIdInAndScheduleIdAndScheduledFor(
                TENANT, machineIds, scheduleId, scheduledFor);

        // verifications
        assertThat(current).extracting(SoftwareScheduleOnlineDispatch::getMachineId).containsExactly("current-reconnect");
    }

    @Test
    void failedStatusWriteLeavesManagedDeviceAssignedToSoftwareSchedule() {
        // setup
        String machineId = "deleted-transaction-device";
        Machine managed = new Machine();
        managed.setTenantId(TENANT);
        managed.setMachineId(machineId);
        managed.setStatus(DeviceStatus.MANAGED);
        mongoTemplate.save(managed);

        SoftwareScheduleMachineAssignedRepository assignments =
                repositoryFactory.getRepository(SoftwareScheduleMachineAssignedRepository.class);
        SoftwareScheduleMachineAssigned assignment = assignments.save(SoftwareScheduleMachineAssigned.builder()
                .tenantId(TENANT).softwareScheduleId("failed-deletion-schedule").machineId(machineId).build());
        ScriptScheduleMachineAssignedRepository scriptAssignments =
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class);
        ScheduleScriptMachineAssigned scriptAssignment = scriptAssignments.save(ScheduleScriptMachineAssigned.builder()
                .tenantId(TENANT).scriptScheduleId("rollback-script").machineId(machineId).build());
        DeviceSoftwareRepository inventory = repositoryFactory.getRepository(DeviceSoftwareRepository.class);
        DeviceSoftware installed = inventory.save(DeviceSoftware.builder()
                .tenantId(TENANT).machineId(machineId).softwareTitleId(101L).build());
        MachineRepository machines = mock(MachineRepository.class);
        when(machines.findOnPrimaryByMachineId(machineId)).thenReturn(Optional.of(managed));
        DeletedMachineCleanup cleanup = new DeletedMachineCleanup(
                scriptAssignments, scriptSchedules(), repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class),
                assignments, softwareSchedules(),
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class),
                inventory, mock(SoftwareProjectionTrigger.class), mock(MachineWriter.class),
                new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory()),
                osStateRepository(),
                osPendingUpdateRepository(),
                osUpdateHistoryRepository(),
                mock(DeviceOsUpdateRolloutStateRepository.class),
                mock(OsUpdateOverrideRepository.class), osUpdatePolicyRepository());
        DeviceService service = new DeviceService(machines, cleanup, mock(AuditRecorder.class),
                mock(DeviceSoftwareConnectivitySync.class),
                mock(MachineWriter.class), mock(TagRepository.class), mock(TagAssignmentRepository.class),
                mock(DeviceStatusProcessor.class), mock(DeviceFilterOptionMapper.class), () -> TENANT,
                mock(ApplicationEventPublisher.class));

        // execution
        assertThatThrownBy(() -> service.updateStatusByMachineId(machineId, DeviceStatus.DELETED))
                .hasMessageContaining(machineId);

        // verifications
        assertThat(scriptAssignments.findById(scriptAssignment.getId())).isPresent();
        assertThat(inventory.findById(installed.getId())).isPresent();
        assertThat(assignments.findById(assignment.getId())).isPresent();
        assertThat(mongoTemplate.findById(managed.getId(), Machine.class)).extracting(Machine::getStatus)
                .isEqualTo(DeviceStatus.MANAGED);
    }

    @Test
    void failedInventoryProjectionRollsBackDeletionSoItCanBeRetried() {
        // setup
        Machine machine = new Machine();
        machine.setTenantId(TENANT);
        machine.setMachineId("atomic-cleanup-device");
        machine.setStatus(DeviceStatus.MANAGED);
        mongoTemplate.save(machine);
        SoftwareScheduleMachineAssignedRepository assignments =
                repositoryFactory.getRepository(SoftwareScheduleMachineAssignedRepository.class);
        SoftwareScheduleMachineAssigned assignment = assignments.save(SoftwareScheduleMachineAssigned.builder()
                .tenantId(TENANT).softwareScheduleId("cleanup-rollback-schedule").machineId(machine.getMachineId()).build());
        DeviceSoftwareRepository inventory = repositoryFactory.getRepository(DeviceSoftwareRepository.class);
        DeviceSoftware installed = inventory.save(DeviceSoftware.builder().tenantId(TENANT)
                .machineId(machine.getMachineId()).softwareTitleId(102L).build());
        SoftwareProjectionTrigger projection = mock(SoftwareProjectionTrigger.class);
        doThrow(new IllegalStateException("simulated inventory projection failure")).doNothing()
                .when(projection).titlesChanged(TENANT, Set.of(102L));
        DeletedMachineCleanup cleanup = new DeletedMachineCleanup(
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class), scriptSchedules(),
                repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class), assignments, softwareSchedules(),
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class), inventory, projection,
                new MachineWriter(mongoTemplate, absent(), absent()),
                new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory()),
                osStateRepository(),
                osPendingUpdateRepository(),
                osUpdateHistoryRepository(),
                mock(DeviceOsUpdateRolloutStateRepository.class),
                mock(OsUpdateOverrideRepository.class), osUpdatePolicyRepository());

        // execution
        assertThatThrownBy(() -> cleanup.markDeleted(machine)).hasMessage("simulated inventory projection failure");

        // verifications
        assertThat(inventory.findById(installed.getId())).isPresent();
        assertThat(assignments.findById(assignment.getId())).isPresent();
        assertThat(mongoTemplate.findById(machine.getId(), Machine.class)).extracting(Machine::getStatus)
                .isEqualTo(DeviceStatus.MANAGED);

        assertThat(cleanup.markDeleted(machine).machine().getStatus()).isEqualTo(DeviceStatus.DELETED);
        assertThat(inventory.findById(installed.getId())).isEmpty();
        assertThat(assignments.findById(assignment.getId())).isEmpty();
    }

    @Test
    void oldReconnectAndDeletionSnapshotsCannotChangeAReenrolledDevice() {
        // setup
        MachineRepository machines = repositoryFactory.getRepository(MachineRepository.class,
                RepositoryFragments.just(new CustomMachineRepositoryImpl(mongoTemplate, mock(ClientVersionThreshold.class))));
        SoftwareScheduleMachineAssignedRepository assignments =
                repositoryFactory.getRepository(SoftwareScheduleMachineAssignedRepository.class);
        SoftwareScheduleOnlineDispatchRepository reconnects =
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class);
        MachineWriter writer = new MachineWriter(mongoTemplate, absent(), absent());
        DeletedMachineCleanup cleanup = new DeletedMachineCleanup(
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class), scriptSchedules(),
                repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class), assignments, softwareSchedules(),
                reconnects,
                mock(DeviceSoftwareRepository.class), mock(SoftwareProjectionTrigger.class), writer,
                new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory()),
                osStateRepository(),
                osPendingUpdateRepository(),
                osUpdateHistoryRepository(),
                mock(DeviceOsUpdateRolloutStateRepository.class),
                mock(OsUpdateOverrideRepository.class), osUpdatePolicyRepository());
        String deviceId = "restored-schedule-device";
        Machine machine = new Machine();
        machine.setTenantId(TENANT);
        machine.setMachineId(deviceId);
        machine.setStatus(DeviceStatus.MANAGED);
        Machine managed = machines.save(machine);
        assertThat(machines.reserveForSoftwareReconnect(TENANT, deviceId, managed.getVersion(), DeviceStatus.CONNECTED)).isEqualTo(1L);
        Machine current = machines.findOnPrimaryByTenantIdAndMachineId(TENANT, deviceId).orElseThrow();

        // execution
        cleanup.markDeleted(current);
        Machine deleted = machines.findOnPrimaryByTenantIdAndMachineId(TENANT, deviceId).orElseThrow();
        cleanup.reenrollDeleted(deleted, machineUpdate().set(STATUS, DeviceStatus.PENDING));
        writer.update(deviceId, machineUpdate().set(STATUS, DeviceStatus.MANAGED)).orElseThrow();
        SoftwareScheduleMachineAssigned deliberateAssignment = assignments.save(SoftwareScheduleMachineAssigned.builder()
                .tenantId(TENANT).softwareScheduleId("new-assignment-schedule").machineId(deviceId).build());

        // verifications
        assertThat(machines.reserveForSoftwareReconnect(TENANT, deviceId, managed.getVersion(), DeviceStatus.CONNECTED)).isZero();
        assertThatThrownBy(() -> cleanup.markDeleted(managed)).isInstanceOf(ConflictException.class)
                .hasMessageContaining("changed during schedule cleanup");
        assertThatThrownBy(() -> cleanup.markDeleted(deleted)).isInstanceOf(ConflictException.class)
                .hasMessageContaining("changed during schedule cleanup");
        Machine restored = machines.findOnPrimaryByTenantIdAndMachineId(TENANT, deviceId).orElseThrow();
        assertThat(restored.getStatus()).isEqualTo(DeviceStatus.MANAGED);
        assertThat(managed.getEnrollmentId()).isNull();
        assertThat(restored.getEnrollmentId()).isNotBlank();
        assertThat(assignments.findById(deliberateAssignment.getId())).isPresent();
    }

    @Test
    void assignmentStartedBeforeReenrollmentDoesNotAttachToNewEnrollment() {
        // setup
        String machineId = "assignment-reenrollment-device";
        MachineRepository machines = repositoryFactory.getRepository(MachineRepository.class,
                RepositoryFragments.just(new CustomMachineRepositoryImpl(mongoTemplate, mock(ClientVersionThreshold.class))));
        Machine machine = new Machine();
        machine.setTenantId(TENANT);
        machine.setMachineId(machineId);
        machine.setStatus(DeviceStatus.MANAGED);
        Machine enrolled = machines.save(machine);
        MachineWriter writer = new MachineWriter(mongoTemplate, absent(), absent());
        ScheduleMutationTransaction transaction = new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory());
        SoftwareScheduleMachineAssignedRepository assignments =
                repositoryFactory.getRepository(SoftwareScheduleMachineAssignedRepository.class);
        DeletedMachineCleanup cleanup = new DeletedMachineCleanup(
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class), scriptSchedules(),
                repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class), assignments, softwareSchedules(),
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class),
                mock(DeviceSoftwareRepository.class), mock(SoftwareProjectionTrigger.class), writer, transaction,
                osStateRepository(),
                osPendingUpdateRepository(),
                osUpdateHistoryRepository(),
                mock(DeviceOsUpdateRolloutStateRepository.class),
                mock(OsUpdateOverrideRepository.class), osUpdatePolicyRepository());
        SoftwareScheduleRepository schedules = repositoryFactory.getRepository(SoftwareScheduleRepository.class);
        SoftwareSchedule schedule = schedules.save(SoftwareSchedule.builder().tenantId(TENANT)
                .selectionMode(ScheduleDeviceSelectionMode.SPECIFIC).status(ScriptStatus.ACTIVE).packages(List.of()).build());
        List<String> ids = List.of(machineId);
        MachineRepository interleavingMachines = mock(MachineRepository.class, delegatesTo(machines));
        doAnswer(invocation -> {
            Collection<String> targetIds = invocation.getArgument(1);
            List<Machine> oldEnrollment = machines.findOnPrimaryByTenantIdAndMachineIdIn(TENANT, targetIds);
            CompletableFuture.runAsync(() -> reenroll(cleanup, writer, machines, enrolled)).get(10, TimeUnit.SECONDS);
            return oldEnrollment;
        }).doAnswer(invocation -> machines.findOnPrimaryByTenantIdAndMachineIdIn(TENANT, invocation.getArgument(1)))
                .when(interleavingMachines).findOnPrimaryByTenantIdAndMachineIdIn(TENANT, Set.copyOf(ids));
        SoftwareScheduleService service = new SoftwareScheduleService(schedules, assignments,
                mock(SoftwareScheduleTargetResolver.class), () -> TENANT, mock(PackageManagerAvailability.class),
                mock(SoftwarePackageSelectionResolver.class), interleavingMachines, transaction, mock(AuditRecorder.class));

        // execution
        assertThatThrownBy(() -> service.addDevices(schedule.getId(), ids, ACTOR)).isInstanceOf(ConflictException.class);

        // verifications
        assertThat(assignments.findByTenantIdAndSoftwareScheduleId(TENANT, schedule.getId())).isEmpty();
        assertThat(machines.findOnPrimaryByTenantIdAndMachineId(TENANT, machineId)).get()
                .extracting(Machine::getStatus).isEqualTo(DeviceStatus.MANAGED);
        service.addDevices(schedule.getId(), ids, ACTOR);
        assertThat(assignments.findByTenantIdAndSoftwareScheduleId(TENANT, schedule.getId()))
                .extracting(SoftwareScheduleMachineAssigned::getMachineId).containsExactly(machineId);
    }

    private static void reenroll(DeletedMachineCleanup cleanup, MachineWriter writer, MachineRepository machines, Machine enrolled) {
        cleanup.markDeleted(enrolled);
        Machine deleted = machines.findOnPrimaryByTenantIdAndMachineId(TENANT, enrolled.getMachineId()).orElseThrow();
        cleanup.reenrollDeleted(deleted, machineUpdate().set(STATUS, DeviceStatus.PENDING));
        writer.update(enrolled.getMachineId(), machineUpdate().set(STATUS, DeviceStatus.MANAGED)).orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> absent() {
        return mock(ObjectProvider.class);
    }

    private static ScriptScheduleRepository scriptSchedules() {
        return repositoryFactory.getRepository(ScriptScheduleRepository.class,
                RepositoryFragments.just(new CustomScriptScheduleRepositoryImpl(mongoTemplate)));
    }

    private static SoftwareScheduleRepository softwareSchedules() {
        return repositoryFactory.getRepository(SoftwareScheduleRepository.class);
    }

    private static DeviceOsStateRepository osStateRepository() {
        return repositoryFactory.getRepository(DeviceOsStateRepository.class,
                RepositoryFragments.just(new CustomDeviceOsStateRepositoryImpl(mongoTemplate)));
    }

    private static OsUpdatePolicyRepository osUpdatePolicyRepository() {
        return repositoryFactory.getRepository(OsUpdatePolicyRepository.class);
    }

    private static DeviceOsPendingUpdateRepository osPendingUpdateRepository() {
        return repositoryFactory.getRepository(DeviceOsPendingUpdateRepository.class,
                RepositoryFragments.just(new CustomDeviceOsPendingUpdateRepositoryImpl(mongoTemplate)));
    }

    private static DeviceOsUpdateHistoryRepository osUpdateHistoryRepository() {
        return repositoryFactory.getRepository(DeviceOsUpdateHistoryRepository.class,
                RepositoryFragments.just(new CustomDeviceOsUpdateHistoryRepositoryImpl(mongoTemplate)));
    }

    private static ScheduleScript seedScriptSchedule(ScheduleDeviceSelectionMode mode) {
        ScheduleScript schedule = mongoTemplate.save(ScheduleScript.builder().tenantId(TENANT).selectionMode(mode).build());
        mongoTemplate.save(ScheduleScriptMachineAssigned.builder()
                .tenantId(TENANT).scriptScheduleId(schedule.getId()).machineId(MACHINE).build());
        mongoTemplate.save(DeviceFirstOnlineDispatch.builder()
                .tenantId(TENANT).scheduleId(schedule.getId()).machineId(MACHINE).status(DeviceOnlineDispatchStatus.NEW).build());
        return schedule;
    }
}
