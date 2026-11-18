package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareAdoptionResponse;
import com.openframe.api.dto.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageAdoptDeliveryFailureReader;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareAdoptionServiceTest {

    private static final String TENANT = "t1";
    private static final String SOFTWARE_ID = "42";
    private static final String REQUEST_ID = "req-1";
    private static final String LATER_REQUEST_ID = "req-2";
    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";
    private static final List<String> PAGE = List.of(MAC);
    private static final String ERROR = "brew install --cask postman: exit 1";
    private static final String ENGINE_ERROR = "EXHAUSTED";
    private static final String STATE_ID = "state-1";
    private static final String OTHER_STATE_ID = "state-2";
    private static final String LATER_STATE_ID = "state-3";

    @Mock private PackageUpdateRequestRepository packageUpdateRequestRepository;
    @Mock private PackageUpdateDeviceStateRepository packageUpdateDeviceStateRepository;
    @Mock private PackageAdoptDeliveryFailureReader packageAdoptDeliveryFailureReader;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private SoftwareAdoptionService service;

    private PackageUpdateRequest request;
    private PackageUpdateRequest laterRequest;
    private Instant now;
    private Instant longAgo;

    @BeforeEach
    void setUp() {
        request = adoptRequest(REQUEST_ID);
        laterRequest = adoptRequest(LATER_REQUEST_ID);
        now = Instant.now();
        longAgo = now.minus(Duration.ofHours(1));
    }

    @Test
    void getAdoptionsByMachineId_noDevice_nothingRead() {
        // setup
        List<String> noMachines = List.of();

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, noMachines);

        // verifications
        assertThat(adoptions).isEmpty();
        verifyNoInteractions(packageUpdateRequestRepository, packageUpdateDeviceStateRepository,
                packageAdoptDeliveryFailureReader);
    }

    @Test
    void getAdoptionsByMachineId_noAdoptRequest_noneAndNoFurtherRead() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndSoftwareIdAndMachineIdsIn(
                TENANT, SoftwareAction.ADOPT, SOFTWARE_ID, PAGE)).thenReturn(List.of());

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, PAGE);

        // verifications
        assertThat(adoptions).isEmpty();
        verifyNoInteractions(packageUpdateDeviceStateRepository, packageAdoptDeliveryFailureReader);
    }

    @Test
    void getAdoptionsByMachineId_inProgressAndNoEngineFailure_adopting() {
        // setup
        PackageUpdateDeviceState inProgress = state(STATE_ID, REQUEST_ID, MAC, SoftwareActionStatus.IN_PROGRESS,
                longAgo);
        stubStates(List.of(request), inProgress);
        stubEngineFailures(inProgress, Map.of());

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, PAGE);

        // verifications
        assertThat(adoptions).containsOnlyKeys(MAC);
        assertThat(adoptions.get(MAC))
                .extracting(SoftwareAdoptionResponse::getStatus, SoftwareAdoptionResponse::getPackageManager,
                        SoftwareAdoptionResponse::getError)
                .containsExactly(SoftwareAdoptionStatus.ADOPTING, PackageManagerType.BREW, null);
    }

    @Test
    void getAdoptionsByMachineId_inProgressButTheEngineFailedIt_failedWithTheEnginesReason() {
        // setup
        PackageUpdateDeviceState inProgress = state(STATE_ID, REQUEST_ID, MAC, SoftwareActionStatus.IN_PROGRESS,
                longAgo);
        stubStates(List.of(request), inProgress);
        stubEngineFailures(inProgress, Map.of(STATE_ID, ENGINE_ERROR));

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, PAGE);

        // verifications
        assertThat(adoptions.get(MAC))
                .extracting(SoftwareAdoptionResponse::getStatus, SoftwareAdoptionResponse::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, ENGINE_ERROR);
    }

    @Test
    void getAdoptionsByMachineId_failedByTheDevice_failedWithItsTextNotTheEngines() {
        // setup
        PackageUpdateDeviceState failed = state(STATE_ID, REQUEST_ID, MAC, SoftwareActionStatus.FAILED, longAgo);
        failed.setFailedMessage(ERROR);
        stubStates(List.of(request), failed);
        stubEngineFailures(failed, Map.of(STATE_ID, ENGINE_ERROR));

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, PAGE);

        // verifications
        assertThat(adoptions.get(MAC))
                .extracting(SoftwareAdoptionResponse::getStatus, SoftwareAdoptionResponse::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, ERROR);
    }

    @Test
    void getAdoptionsByMachineId_completed_none() {
        // setup
        stubStates(List.of(request), state(STATE_ID, REQUEST_ID, MAC, SoftwareActionStatus.COMPLETED, longAgo));

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, PAGE);

        // verifications
        assertThat(adoptions).isEmpty();
    }

    @Test
    void getAdoptionsByMachineId_repeatAdoptAfterAFailure_theLatestShows() {
        // setup
        PackageUpdateDeviceState failedEarlier = state(STATE_ID, REQUEST_ID, MAC, SoftwareActionStatus.FAILED, longAgo);
        failedEarlier.setFailedMessage(ERROR);
        PackageUpdateDeviceState completedLater = state(LATER_STATE_ID, LATER_REQUEST_ID, MAC,
                SoftwareActionStatus.COMPLETED, now);
        stubStates(List.of(request, laterRequest), failedEarlier, completedLater);

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, PAGE);

        // verifications
        assertThat(adoptions).isEmpty();
    }

    @Test
    void getAdoptionsByMachineId_stateOfADeviceOffThePage_left() {
        // setup
        stubStates(List.of(request), state(STATE_ID, REQUEST_ID, MAC, SoftwareActionStatus.COMPLETED, longAgo),
                state(OTHER_STATE_ID, REQUEST_ID, OTHER_MAC, SoftwareActionStatus.FAILED, longAgo));

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, PAGE);

        // verifications
        assertThat(adoptions).doesNotContainKey(OTHER_MAC);
    }

    @Test
    void getAdoptionsByMachineId_severalDevicesInProgress_engineReadOnceForAllOfThem() {
        // setup
        List<String> page = List.of(MAC, OTHER_MAC);
        PackageUpdateDeviceState first = state(STATE_ID, REQUEST_ID, MAC, SoftwareActionStatus.IN_PROGRESS, now);
        PackageUpdateDeviceState second = state(OTHER_STATE_ID, REQUEST_ID, OTHER_MAC,
                SoftwareActionStatus.IN_PROGRESS, now);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndSoftwareIdAndMachineIdsIn(
                TENANT, SoftwareAction.ADOPT, SOFTWARE_ID, page)).thenReturn(List.of(request));
        when(packageUpdateDeviceStateRepository.findByTenantIdAndRequestIdIn(TENANT, Set.of(REQUEST_ID)))
                .thenReturn(List.of(first, second));

        // execution
        Map<String, SoftwareAdoptionResponse> adoptions = service.getAdoptionsByMachineId(SOFTWARE_ID, page);

        // verifications
        assertThat(adoptions).containsOnlyKeys(MAC, OTHER_MAC);
        verify(packageAdoptDeliveryFailureReader).getFailedMessagesByStateId(argThat(
                (Collection<PackageUpdateDeviceState> given) -> given.containsAll(List.of(first, second))));
    }

    private void stubStates(List<PackageUpdateRequest> requests, PackageUpdateDeviceState... states) {
        Set<String> requestIds = Set.copyOf(requests.stream().map(PackageUpdateRequest::getRequestId).toList());
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(packageUpdateRequestRepository.findByTenantIdAndActionAndSoftwareIdAndMachineIdsIn(
                TENANT, SoftwareAction.ADOPT, SOFTWARE_ID, PAGE)).thenReturn(requests);
        when(packageUpdateDeviceStateRepository.findByTenantIdAndRequestIdIn(TENANT, requestIds))
                .thenReturn(List.of(states));
    }

    private void stubEngineFailures(PackageUpdateDeviceState state, Map<String, String> failures) {
        when(packageAdoptDeliveryFailureReader.getFailedMessagesByStateId(argThat(
                (Collection<PackageUpdateDeviceState> given) -> given.contains(state))))
                .thenReturn(failures);
    }

    private static PackageUpdateRequest adoptRequest(String requestId) {
        return PackageUpdateRequest.builder()
                .tenantId(TENANT)
                .requestId(requestId)
                .action(SoftwareAction.ADOPT)
                .softwareId(SOFTWARE_ID)
                .packageManager(PackageManagerType.BREW)
                .packageName("postman")
                .build();
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
}
