package com.openframe.client.listener.packageadopt;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageAdoptDeliveryFailureReader;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.track.DeliveryId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageAdoptEngineFailureSweepTest {

    private static final String TENANT = "t1";
    private static final String REQUEST_ID = "req-1";
    private static final String NEXT_REQUEST_ID = "req-2";
    private static final String REQUEST_DOC_ID = "6740a0000000000000000001";
    private static final String NEXT_REQUEST_DOC_ID = "6740a0000000000000000002";
    private static final String MACHINE_ID = "m1";
    private static final String OTHER_MACHINE_ID = "m2";
    private static final String STATE_ID = "state-1";
    private static final String OTHER_STATE_ID = "state-2";
    private static final String NEXT_STATE_ID = "state-3";
    private static final int BATCH_SIZE = 100;

    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private PackageUpdateRequestRepository packageUpdateRequestRepository;
    @Mock private PackageUpdateDeviceStateRepository packageUpdateDeviceStateRepository;
    @Mock private MachineDeliveryRepository machineDeliveryRepository;
    @Mock private PackageAdoptStatusProcessor packageAdoptStatusProcessor;

    private PackageAdoptEngineFailureSweep sweep;
    private PackageUpdateRequest request;
    private PackageUpdateRequest nextRequest;
    private Instant now;
    private Instant longAgo;

    @BeforeEach
    void setUp() {
        PackageAdoptDeliveryFailureReader reader = new PackageAdoptDeliveryFailureReader(machineDeliveryRepository);
        sweep = new PackageAdoptEngineFailureSweep(tenantIdProvider, packageUpdateRequestRepository,
                packageUpdateDeviceStateRepository, reader, packageAdoptStatusProcessor);
        ReflectionTestUtils.setField(sweep, "batchSize", BATCH_SIZE);
        request = adoptRequest(REQUEST_DOC_ID, REQUEST_ID);
        nextRequest = adoptRequest(NEXT_REQUEST_DOC_ID, NEXT_REQUEST_ID);
        now = Instant.now();
        longAgo = now.minus(Duration.ofHours(1));
    }

    @Test
    void sweep_deliveryFailedByTheEngine_closedWithTheEnginesReason() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, longAgo));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID)),
                delivery(MACHINE_ID, DeliveryStatus.FAILED, DeliveryFailure.EXHAUSTED));

        // execution
        sweep.sweep();

        // verifications
        verify(packageAdoptStatusProcessor).failByEngine(request, MACHINE_ID, "EXHAUSTED");
        verify(packageAdoptStatusProcessor, never()).rollUp(request);
    }

    @Test
    void sweep_pageShorterThanTheBatch_noFurtherPageRead() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, now));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID)));

        // execution
        sweep.sweep();

        // verifications
        verify(packageUpdateRequestRepository, never()).findByTenantIdAndActionAndStatusAndIdGreaterThanOrderByIdAsc(
                TENANT, SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, REQUEST_DOC_ID, Limit.of(BATCH_SIZE));
    }

    @Test
    void sweep_engineFailureOnTheSecondPage_closedAndAnEmptyPageStopsTheWalk() {
        // setup
        ReflectionTestUtils.setField(sweep, "batchSize", 1);
        Limit one = Limit.of(1);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndStatusOrderByIdAsc(TENANT,
                SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, one)).thenReturn(List.of(request));
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndStatusAndIdGreaterThanOrderByIdAsc(TENANT,
                SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, REQUEST_DOC_ID, one))
                .thenReturn(List.of(nextRequest));
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndStatusAndIdGreaterThanOrderByIdAsc(TENANT,
                SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, NEXT_REQUEST_DOC_ID, one))
                .thenReturn(List.of());
        when(packageUpdateDeviceStateRepository.findByTenantIdAndRequestIdIn(TENANT, Set.of(REQUEST_ID)))
                .thenReturn(List.of(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, longAgo)));
        PackageUpdateDeviceState onPageTwo = state(NEXT_STATE_ID, NEXT_REQUEST_ID, MACHINE_ID,
                SoftwareActionStatus.IN_PROGRESS, longAgo);
        when(packageUpdateDeviceStateRepository.findByTenantIdAndRequestIdIn(TENANT, Set.of(NEXT_REQUEST_ID)))
                .thenReturn(List.of(onPageTwo));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID)), delivery(MACHINE_ID, DeliveryStatus.PENDING, null));
        stubDeliveries(Set.of(deliveryId(NEXT_REQUEST_ID, MACHINE_ID)),
                delivery(NEXT_REQUEST_ID, MACHINE_ID, DeliveryStatus.FAILED, DeliveryFailure.TIMEOUT));

        // execution
        sweep.sweep();

        // verifications
        verify(packageAdoptStatusProcessor).failByEngine(nextRequest, MACHINE_ID, "TIMEOUT");
        verify(packageAdoptStatusProcessor, never()).failByEngine(request, MACHINE_ID, "TIMEOUT");
        verify(packageUpdateRequestRepository).findByTenantIdAndActionAndStatusAndIdGreaterThanOrderByIdAsc(TENANT,
                SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, NEXT_REQUEST_DOC_ID, one);
    }

    @Test
    void sweep_noDeliveryRowPastTheGrace_closedAsNotDelivered() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, longAgo));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID)));

        // execution
        sweep.sweep();

        // verifications
        verify(packageAdoptStatusProcessor).failByEngine(request, MACHINE_ID,
                PackageAdoptDeliveryFailureReader.NOT_DELIVERED_ERROR);
    }

    @Test
    void sweep_noDeliveryRowWithinTheGrace_leftAdopting() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, now));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID)));

        // execution
        sweep.sweep();

        // verifications
        verifyNoInteractions(packageAdoptStatusProcessor);
    }

    @Test
    void sweep_openDelivery_leftAdopting() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, longAgo));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID)), delivery(MACHINE_ID, DeliveryStatus.PENDING, null));

        // execution
        sweep.sweep();

        // verifications
        verifyNoInteractions(packageAdoptStatusProcessor);
    }

    @Test
    void sweep_finishedStateBesideAFailedOne_onlyTheInProgressOneClosed() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, longAgo),
                state(OTHER_STATE_ID, OTHER_MACHINE_ID, SoftwareActionStatus.COMPLETED, longAgo));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID)),
                delivery(MACHINE_ID, DeliveryStatus.FAILED, DeliveryFailure.OFFLINE));

        // execution
        sweep.sweep();

        // verifications
        verify(packageAdoptStatusProcessor).failByEngine(request, MACHINE_ID, "OFFLINE");
        verify(packageAdoptStatusProcessor, never()).failByEngine(request, OTHER_MACHINE_ID, "OFFLINE");
    }

    @Test
    void sweep_requestWithEveryStateFinished_rolledUpWithoutAnEngineRead() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.COMPLETED, longAgo),
                state(OTHER_STATE_ID, OTHER_MACHINE_ID, SoftwareActionStatus.FAILED, longAgo));

        // execution
        sweep.sweep();

        // verifications
        verify(packageAdoptStatusProcessor).rollUp(request);
        verify(packageAdoptStatusProcessor, never()).failByEngine(request, MACHINE_ID, "FAILED");
        verifyNoInteractions(machineDeliveryRepository);
    }

    @Test
    void sweep_noAdoptInProgress_nothingElseRead() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndStatusOrderByIdAsc(TENANT,
                SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, Limit.of(BATCH_SIZE))).thenReturn(List.of());

        // execution
        sweep.sweep();

        // verifications
        verifyNoInteractions(packageUpdateDeviceStateRepository, machineDeliveryRepository,
                packageAdoptStatusProcessor);
    }

    @Test
    void sweep_severalDevices_oneEngineReadForAllOfThem() {
        // setup
        stubStates(state(STATE_ID, MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, now),
                state(OTHER_STATE_ID, OTHER_MACHINE_ID, SoftwareActionStatus.IN_PROGRESS, now));
        stubDeliveries(Set.of(deliveryId(MACHINE_ID), deliveryId(OTHER_MACHINE_ID)));

        // execution
        sweep.sweep();

        // verifications
        verify(machineDeliveryRepository).findAllById(anyIterable());
    }

    private void stubStates(PackageUpdateDeviceState... states) {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndStatusOrderByIdAsc(TENANT,
                SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(request));
        when(packageUpdateDeviceStateRepository.findByTenantIdAndRequestIdIn(TENANT, Set.of(REQUEST_ID)))
                .thenReturn(List.of(states));
    }

    private void stubDeliveries(Set<String> ids, MachineDelivery... deliveries) {
        doReturn(List.of(deliveries)).when(machineDeliveryRepository).findAllById(argThat(
                (Iterable<String> given) -> Set.copyOf((List<String>) given).equals(ids)));
    }

    private static PackageUpdateRequest adoptRequest(String id, String requestId) {
        return PackageUpdateRequest.builder()
                .id(id)
                .tenantId(TENANT)
                .requestId(requestId)
                .action(SoftwareAction.ADOPT)
                .status(SoftwareActionStatus.IN_PROGRESS)
                .build();
    }

    private static PackageUpdateDeviceState state(String id, String machineId, SoftwareActionStatus status,
                                                  Instant createdAt) {
        return state(id, REQUEST_ID, machineId, status, createdAt);
    }

    private static PackageUpdateDeviceState state(String id, String requestId, String machineId,
                                                  SoftwareActionStatus status, Instant createdAt) {
        return PackageUpdateDeviceState.builder()
                .id(id)
                .tenantId(TENANT)
                .requestId(requestId)
                .machineId(machineId)
                .status(status)
                .createdAt(createdAt)
                .build();
    }

    private static MachineDelivery delivery(String machineId, DeliveryStatus status, DeliveryFailure failure) {
        return delivery(REQUEST_ID, machineId, status, failure);
    }

    private static MachineDelivery delivery(String requestId, String machineId, DeliveryStatus status,
                                            DeliveryFailure failure) {
        return MachineDelivery.builder()
                .id(deliveryId(requestId, machineId))
                .type(DeliveryType.PACKAGE_ADOPT)
                .targetId(requestId)
                .machineId(machineId)
                .status(status)
                .failure(failure)
                .build();
    }

    private static String deliveryId(String machineId) {
        return deliveryId(REQUEST_ID, machineId);
    }

    private static String deliveryId(String requestId, String machineId) {
        return DeliveryId.of(DeliveryType.PACKAGE_ADOPT, requestId, machineId);
    }
}
