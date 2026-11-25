package com.openframe.gateway.config.ws;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.test.publisher.PublisherProbe;
import reactor.test.scheduler.VirtualTimeScheduler;
import reactor.util.context.Context;

import java.time.Duration;
import java.time.Instant;

import static com.openframe.gateway.config.ws.RelayAccessWatcher.DEVICE_REMOVED;
import static com.openframe.gateway.config.ws.RelayAccessWatcher.RECHECK_INTERVAL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RelayAccessWatcherTest {

    private static final String SESSION_ID = "session-1";
    private static final String TENANT_ID = "4d256d67-c365-4e25-ba89-4e0e767c5036";
    private static final String MACHINE_ID = "8daa5e90-707c-4fab-8cda-d11550b0d26b";
    private static final String CONTEXT_KEY = "shared-domain";
    private static final Duration UNTIL_FIRST_CHECK = Duration.ofMinutes(8);
    private static final Duration JUST_BEFORE_FIRST_CHECK = UNTIL_FIRST_CHECK.minusSeconds(1);

    @Mock private ReactiveMachineRepository machineRepository;
    @Mock private WebSocketSession session;

    private RelayAccessWatcher watcher;
    private RelayAccessWatcher singleTenantWatcher;
    private VirtualTimeScheduler virtualTime;
    private RelayDevice device;
    private Instant firstCheckAt;
    private PublisherProbe<Void> closeProbe;

    @BeforeEach
    void setUp() {
        virtualTime = VirtualTimeScheduler.getOrSet();
        watcher = new RelayAccessWatcher(machineRepository, true);
        singleTenantWatcher = new RelayAccessWatcher(machineRepository, false);
        device = new RelayDevice(TENANT_ID, MACHINE_ID);
        firstCheckAt = Instant.now().plus(UNTIL_FIRST_CHECK);
        closeProbe = PublisherProbe.empty();
    }

    @AfterEach
    void tearDown() {
        VirtualTimeScheduler.reset();
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void watch_machineRemovedAtFirstCheck_sessionClosed(DeviceStatus status) {
        // setup
        Machine machine = machineWithStatus(status);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Mono.just(machine));
        stubSessionClose();

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verify(session).close(DEVICE_REMOVED);
    }

    @Test
    void watch_machineRemoved_closeIsSubscribed() {
        // setup
        Machine deleted = machineWithStatus(DeviceStatus.DELETED);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Mono.just(deleted));
        stubSessionClose();

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        assertThat(closeProbe.wasSubscribed()).isTrue();
    }

    @Test
    void watch_machineNotFound_sessionKeptOpen() {
        // setup
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Mono.empty());

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verify(session, never()).close(DEVICE_REMOVED);
    }

    @Test
    void watch_machineNotFoundThenRemoved_sessionClosedAtNextCheck() {
        // setup
        Machine deleted = machineWithStatus(DeviceStatus.DELETED);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Mono.empty(), Mono.just(deleted));
        stubSessionClose();

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);
        virtualTime.advanceTimeBy(RECHECK_INTERVAL);

        // verifications
        verify(session).close(DEVICE_REMOVED);
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = DeviceStatus.class, names = {"MANAGED", "PENDING"})
    void watch_machineStillThere_sessionKeptOpen(DeviceStatus status) {
        // setup
        Machine machine = machineWithStatus(status);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Mono.just(machine));

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verify(session, never()).close(DEVICE_REMOVED);
    }

    @Test
    void watch_beforeFirstCheck_machineNotLookedUp() {
        // setup

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(JUST_BEFORE_FIRST_CHECK);

        // verifications
        verifyNoInteractions(machineRepository);
    }

    @Test
    void watch_machineRemovedAfterFirstCheck_sessionClosedAtNextCheck() {
        // setup
        Machine managed = machineWithStatus(DeviceStatus.MANAGED);
        Machine deleted = machineWithStatus(DeviceStatus.DELETED);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Mono.just(managed), Mono.just(deleted));
        stubSessionClose();

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);
        virtualTime.advanceTimeBy(RECHECK_INTERVAL);

        // verifications
        verify(session).close(DEVICE_REMOVED);
    }

    @Test
    void watch_machineRemovedAfterFirstCheck_sessionKeptOpenUntilNextCheck() {
        // setup
        Machine managed = machineWithStatus(DeviceStatus.MANAGED);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Mono.just(managed));
        Duration justBeforeSecondCheck = RECHECK_INTERVAL.minusSeconds(1);

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);
        virtualTime.advanceTimeBy(justBeforeSecondCheck);

        // verifications
        verify(machineRepository).findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID);
    }

    @Test
    void watch_lookupFails_sessionKeptOpenAndCheckedAgain() {
        // setup
        Machine deleted = machineWithStatus(DeviceStatus.DELETED);
        Mono<Machine> failure = Mono.error(new IllegalStateException("mongo down"));
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(failure, Mono.just(deleted));
        stubSessionClose();

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);
        virtualTime.advanceTimeBy(RECHECK_INTERVAL);

        // verifications
        verify(session).close(DEVICE_REMOVED);
    }

    @Test
    void watch_lookupFails_sessionNotClosed() {
        // setup
        Mono<Machine> failure = Mono.error(new IllegalStateException("mongo down"));
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(failure);

        // execution
        watcher.watch(session, device, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verify(session, never()).close(DEVICE_REMOVED);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void watch_tenantRoutingWithoutTenant_machineNotLookedUp(String tenantId) {
        // setup
        RelayDevice noTenantDevice = new RelayDevice(tenantId, MACHINE_ID);
        when(session.getId()).thenReturn(SESSION_ID);

        // execution
        watcher.watch(session, noTenantDevice, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verifyNoInteractions(machineRepository);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void watch_tenantRoutingWithoutTenant_returnsDisposedWatch(String tenantId) {
        // setup
        RelayDevice noTenantDevice = new RelayDevice(tenantId, MACHINE_ID);
        when(session.getId()).thenReturn(SESSION_ID);

        // execution
        Disposable watch = watcher.watch(session, noTenantDevice, firstCheckAt, Context.empty());

        // verifications
        assertThat(watch.isDisposed()).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", TENANT_ID})
    void watch_singleTenantMode_machineLookedUpByIdOnly(String tenantId) {
        // setup
        RelayDevice singleTenantDevice = new RelayDevice(tenantId, MACHINE_ID);
        Machine deleted = machineWithStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(deleted));
        stubSessionClose();

        // execution
        singleTenantWatcher.watch(session, singleTenantDevice, firstCheckAt, Context.empty());
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verify(session).close(DEVICE_REMOVED);
    }

    @Test
    void watch_requestContext_reachesTheLookup() {
        // setup
        Context requestContext = Context.of(CONTEXT_KEY, DeviceStatus.DELETED);
        Mono<Machine> statusFromContext = Mono.deferContextual(context ->
                Mono.just(machineWithStatus(context.getOrDefault(CONTEXT_KEY, DeviceStatus.MANAGED))));
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(statusFromContext);
        stubSessionClose();

        // execution
        watcher.watch(session, device, firstCheckAt, requestContext);
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verify(session).close(DEVICE_REMOVED);
    }

    @Test
    void watch_firstCheckAlreadyDue_checkedImmediately() {
        // setup
        Instant overdue = Instant.now().minusSeconds(30);
        Machine deleted = machineWithStatus(DeviceStatus.DELETED);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Mono.just(deleted));
        stubSessionClose();

        // execution
        watcher.watch(session, device, overdue, Context.empty());
        virtualTime.advanceTime();

        // verifications
        verify(session).close(DEVICE_REMOVED);
    }

    @Test
    void watch_disposedBeforeFirstCheck_machineNotLookedUp() {
        // setup

        // execution
        Disposable watch = watcher.watch(session, device, firstCheckAt, Context.empty());
        watch.dispose();
        virtualTime.advanceTimeBy(UNTIL_FIRST_CHECK);

        // verifications
        verifyNoInteractions(machineRepository);
    }

    private void stubSessionClose() {
        when(session.getId()).thenReturn(SESSION_ID);
        when(session.close(DEVICE_REMOVED)).thenReturn(closeProbe.mono());
    }

    private static Machine machineWithStatus(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setTenantId(TENANT_ID);
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(status);
        return machine;
    }
}
