package com.openframe.api.integration.service;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.api.service.rmm.schedule.ScheduleDeliveryRefresher;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.api.service.rmm.schedule.ScheduleScriptDeviceService;
import com.openframe.data.service.rmm.ScheduleMutationTransaction;
import com.openframe.core.exception.ConflictException;
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
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.rmm.CustomScriptScheduleRepositoryImpl;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import com.openframe.data.service.rmm.software.DeviceSoftwareConnectivitySync;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

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
            container = new MongoDBContainer(DockerImageName.parse("mongo:7"));
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

        assertThatThrownBy(() -> service.removeDevices(criteria.getId(), List.of(MACHINE), ACTOR))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("selects devices by criteria");
        assertThat(assignments.findByTenantIdAndScriptScheduleId(TENANT, criteria.getId())).hasSize(1);
        assertThat(dispatches.findByTenantIdAndMachineIdAndScheduleId(TENANT, MACHINE, criteria.getId())).isPresent();

        assertThat(service.removeAssignedDevices(legacy.getId(), List.of(MACHINE, MACHINE, "missing"), ACTOR)).isEqualTo(1);
        assertThat(service.removeAssignedDevices(legacy.getId(), List.of(MACHINE), ACTOR)).isZero();
        assertThat(assignments.findByTenantIdAndScriptScheduleId(TENANT, legacy.getId())).isEmpty();
        assertThat(dispatches.findByTenantIdAndMachineIdAndScheduleId(TENANT, MACHINE, legacy.getId())).isEmpty();
    }

    @Test
    void lateReconnectCompletionDoesNotRestoreADeletedPendingRow() {
        SoftwareScheduleOnlineDispatchRepository reconnects =
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class);
        SoftwareScheduleOnlineDispatch pending = reconnects.save(SoftwareScheduleOnlineDispatch.builder()
                .tenantId(TENANT)
                .scheduleId("software-schedule")
                .machineId(MACHINE)
                .status(DeviceOnlineDispatchStatus.NEW)
                .build());

        assertThat(reconnects.deleteByTenantIdAndMachineIdAndStatus(TENANT, MACHINE, DeviceOnlineDispatchStatus.NEW)).isEqualTo(1);
        assertThat(reconnects.transitionIfNew(TENANT, pending.getId(), DeviceOnlineDispatchStatus.DISPATCHED, Instant.now()))
                .isZero();
        assertThat(reconnects.findById(pending.getId())).isEmpty();
    }

    @Test
    void failedStatusWriteLeavesManagedDeviceAssignedToSoftwareSchedule() {
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
        MachineRepository machines = mock(MachineRepository.class);
        when(machines.findOnPrimaryByMachineId(machineId)).thenReturn(Optional.of(managed));
        DeletedMachineCleanup cleanup = new DeletedMachineCleanup(
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class),
                repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class), assignments,
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class),
                mock(DeviceSoftwareRepository.class), mock(SoftwareProjectionTrigger.class), mock(MachineWriter.class),
                new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory()));
        DeviceService service = new DeviceService(machines, cleanup, mock(DeviceSoftwareConnectivitySync.class),
                mock(MachineWriter.class), mock(TagRepository.class), mock(TagAssignmentRepository.class),
                mock(DeviceStatusProcessor.class), mock(DeviceFilterOptionMapper.class), () -> TENANT,
                mock(ApplicationEventPublisher.class));

        assertThatThrownBy(() -> service.updateStatusByMachineId(machineId, DeviceStatus.DELETED))
                .hasMessageContaining(machineId);
        assertThat(assignments.findById(assignment.getId())).isPresent();
        assertThat(mongoTemplate.findById(managed.getId(), Machine.class)).extracting(Machine::getStatus)
                .isEqualTo(DeviceStatus.MANAGED);
    }

    @Test
    void failedScheduleCleanupRollsBackTheDeletedStatusAndMembership() {
        Machine machine = new Machine();
        machine.setTenantId(TENANT);
        machine.setMachineId("atomic-cleanup-device");
        machine.setStatus(DeviceStatus.MANAGED);
        mongoTemplate.save(machine);
        SoftwareScheduleMachineAssignedRepository assignments =
                repositoryFactory.getRepository(SoftwareScheduleMachineAssignedRepository.class);
        SoftwareScheduleMachineAssigned assignment = assignments.save(SoftwareScheduleMachineAssigned.builder()
                .tenantId(TENANT).softwareScheduleId("cleanup-rollback-schedule").machineId(machine.getMachineId()).build());
        SoftwareScheduleOnlineDispatchRepository reconnects = mock(SoftwareScheduleOnlineDispatchRepository.class);
        doThrow(new IllegalStateException("simulated reconnect cleanup failure"))
                .when(reconnects).deleteByTenantIdAndMachineIdAndStatus(TENANT, machine.getMachineId(), DeviceOnlineDispatchStatus.NEW);
        DeletedMachineCleanup cleanup = new DeletedMachineCleanup(
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class),
                repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class), assignments, reconnects,
                mock(DeviceSoftwareRepository.class), mock(SoftwareProjectionTrigger.class),
                new MachineWriter(mongoTemplate, absent(), absent()),
                new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory()));

        assertThatThrownBy(() -> cleanup.markDeleted(machine)).hasMessage("simulated reconnect cleanup failure");
        assertThat(assignments.findById(assignment.getId())).isPresent();
        assertThat(mongoTemplate.findById(machine.getId(), Machine.class)).extracting(Machine::getStatus)
                .isEqualTo(DeviceStatus.MANAGED);
    }

    @Test
    void oldReconnectAndDeletionSnapshotsCannotChangeAReenrolledDevice() {
        MachineRepository machines = repositoryFactory.getRepository(MachineRepository.class,
                RepositoryFragments.just(new CustomMachineRepositoryImpl(mongoTemplate, mock(ClientVersionThreshold.class))));
        SoftwareScheduleMachineAssignedRepository assignments =
                repositoryFactory.getRepository(SoftwareScheduleMachineAssignedRepository.class);
        SoftwareScheduleOnlineDispatchRepository reconnects =
                repositoryFactory.getRepository(SoftwareScheduleOnlineDispatchRepository.class);
        MachineWriter writer = new MachineWriter(mongoTemplate, absent(), absent());
        DeletedMachineCleanup cleanup = new DeletedMachineCleanup(
                repositoryFactory.getRepository(ScriptScheduleMachineAssignedRepository.class),
                repositoryFactory.getRepository(DeviceOnlineDispatchRepository.class), assignments, reconnects,
                mock(DeviceSoftwareRepository.class), mock(SoftwareProjectionTrigger.class), writer,
                new ScheduleMutationTransaction(mongoTemplate.getMongoDatabaseFactory()));
        String deviceId = "restored-schedule-device";
        Machine machine = new Machine();
        machine.setTenantId(TENANT);
        machine.setMachineId(deviceId);
        machine.setStatus(DeviceStatus.MANAGED);
        Machine managed = machines.save(machine);
        assertThat(machines.reserveForSoftwareReconnect(TENANT, deviceId, managed.getVersion(), DeviceStatus.CONNECTED)).isEqualTo(1L);
        cleanup.markDeleted(managed);
        Machine deleted = machines.findOnPrimaryByTenantIdAndMachineId(TENANT, deviceId).orElseThrow();
        cleanup.reenrollDeleted(deleted, machineUpdate().set(STATUS, DeviceStatus.PENDING));
        writer.update(deviceId, machineUpdate().set(STATUS, DeviceStatus.MANAGED)).orElseThrow();
        SoftwareScheduleMachineAssigned deliberateAssignment = assignments.save(SoftwareScheduleMachineAssigned.builder()
                .tenantId(TENANT).softwareScheduleId("new-assignment-schedule").machineId(deviceId).build());

        assertThat(machines.reserveForSoftwareReconnect(TENANT, deviceId, managed.getVersion(), DeviceStatus.CONNECTED)).isZero();
        assertThatThrownBy(() -> cleanup.markDeleted(deleted)).isInstanceOf(ConflictException.class)
                .hasMessageContaining("changed during schedule cleanup");
        assertThat(machines.findOnPrimaryByTenantIdAndMachineId(TENANT, deviceId)).get().extracting(Machine::getStatus)
                .isEqualTo(DeviceStatus.MANAGED);
        assertThat(assignments.findById(deliberateAssignment.getId())).isPresent();
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> absent() {
        return mock(ObjectProvider.class);
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
