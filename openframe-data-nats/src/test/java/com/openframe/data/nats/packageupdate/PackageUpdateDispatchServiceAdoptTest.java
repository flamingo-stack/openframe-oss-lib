package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageAdoptDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageUpdateDispatchServiceAdoptTest {

    private static final String TENANT = "t1";
    private static final String EXECUTION_ID = "exec-1";
    private static final String SOFTWARE_ID = "42";
    private static final String CASK = "postman";
    private static final String BUNDLE_ID = "com.postmanlabs.mac";
    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";

    @Mock private DeliveryRouter deliveryRouter;
    @Mock private PackageUpdateRequestRepository requestRepository;
    @Mock private PackageUpdateDeviceStateRepository deviceStateRepository;
    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @Captor private ArgumentCaptor<PackageUpdateRequest> requestCaptor;
    @Captor private ArgumentCaptor<List<PackageUpdateDeviceState>> statesCaptor;
    @Captor private ArgumentCaptor<RunningExecutionRows> rowsCaptor;
    @Captor private ArgumentCaptor<PackageAdoptDeliverySeed> seedCaptor;

    @InjectMocks private PackageUpdateDispatchService service;

    private RunningExecutionRows rows;

    @BeforeEach
    void setUp() {
        rows = RunningExecutionRows.builder()
                .executionId(EXECUTION_ID)
                .scriptId("brew-install")
                .machineIds(List.of(MAC, OTHER_MAC, MAC))
                .initiatedBy("user-1")
                .source(ExecutionSource.PACKAGE_INSTALLATION)
                .packageManager(PackageManagerType.BREW)
                .packageName(CASK)
                .softwareAction(SoftwareAction.ADOPT)
                .build();
    }

    @Test
    void dispatchAdopt_casks_adoptRequestInProgressForTheTitle() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        String requestId = service.dispatchAdopt(rows, BrewPackageType.CASK, SOFTWARE_ID, BUNDLE_ID);

        // verifications
        verify(requestRepository).save(requestCaptor.capture());
        assertThat(requestCaptor.getValue())
                .extracting(PackageUpdateRequest::getTenantId, PackageUpdateRequest::getRequestId,
                        PackageUpdateRequest::getExecutionId, PackageUpdateRequest::getAction,
                        PackageUpdateRequest::getSource, PackageUpdateRequest::getPackageManager,
                        PackageUpdateRequest::getPackageName, PackageUpdateRequest::getBrewPackageType,
                        PackageUpdateRequest::getSoftwareId, PackageUpdateRequest::getStatus,
                        PackageUpdateRequest::getMachineIds, PackageUpdateRequest::getTotalMachineCount,
                        PackageUpdateRequest::getInitiatedBy)
                .containsExactly(TENANT, requestId, EXECUTION_ID, SoftwareAction.ADOPT, PackageUpdateSource.ADMIN,
                        PackageManagerType.BREW, CASK, BrewPackageType.CASK, SOFTWARE_ID,
                        SoftwareActionStatus.IN_PROGRESS, List.of(MAC, OTHER_MAC), 2, "user-1");
        assertThat(requestCaptor.getValue().getCreatedAt()).isNotNull();
    }

    @Test
    void dispatchAdopt_casks_oneInProgressStatePerDevice() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        String requestId = service.dispatchAdopt(rows, BrewPackageType.CASK, SOFTWARE_ID, BUNDLE_ID);

        // verifications
        verify(deviceStateRepository).saveAll(statesCaptor.capture());
        assertThat(statesCaptor.getValue())
                .extracting(PackageUpdateDeviceState::getTenantId, PackageUpdateDeviceState::getRequestId,
                        PackageUpdateDeviceState::getMachineId, PackageUpdateDeviceState::getStatus)
                .containsExactly(tuple(TENANT, requestId, MAC, SoftwareActionStatus.IN_PROGRESS),
                        tuple(TENANT, requestId, OTHER_MAC, SoftwareActionStatus.IN_PROGRESS));
        assertThat(statesCaptor.getValue())
                .extracting(PackageUpdateDeviceState::getCreatedAt)
                .doesNotContainNull();
    }

    @Test
    void dispatchAdopt_casks_queuedHistoryRowsOfTheRequest() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        String requestId = service.dispatchAdopt(rows, BrewPackageType.CASK, SOFTWARE_ID, BUNDLE_ID);

        // verifications
        verify(scriptExecutionRepository).saveQueued(rowsCaptor.capture());
        assertThat(rowsCaptor.getValue())
                .extracting(RunningExecutionRows::getTenantId, RunningExecutionRows::getExecutionId,
                        RunningExecutionRows::getMachineIds, RunningExecutionRows::getPackageUpdateRequestId,
                        RunningExecutionRows::getSoftwareAction, RunningExecutionRows::getScriptId)
                .containsExactly(TENANT, EXECUTION_ID, List.of(MAC, OTHER_MAC), requestId, SoftwareAction.ADOPT,
                        "brew-install");
    }

    @Test
    void dispatchAdopt_casks_adoptOrderPerDeviceAfterTheRecords() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        PackageReference caskRef = PackageReference.builder()
                .manager(PackageManagerType.BREW)
                .kind(BrewPackageType.CASK)
                .name(CASK)
                .build();
        InOrder recordsThenOrders = inOrder(scriptExecutionRepository, requestRepository, deviceStateRepository,
                deliveryRouter);

        // execution
        String requestId = service.dispatchAdopt(rows, BrewPackageType.CASK, SOFTWARE_ID, BUNDLE_ID);

        // verifications
        recordsThenOrders.verify(scriptExecutionRepository).saveQueued(rowsCaptor.capture());
        recordsThenOrders.verify(requestRepository).save(requestCaptor.capture());
        recordsThenOrders.verify(deviceStateRepository).saveAll(statesCaptor.capture());
        recordsThenOrders.verify(deliveryRouter, times(2)).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getAllValues())
                .extracting(PackageAdoptDeliverySeed::getType, PackageAdoptDeliverySeed::getTargetId,
                        PackageAdoptDeliverySeed::getMachineId, PackageAdoptDeliverySeed::getPackageRef,
                        PackageAdoptDeliverySeed::getBundleId)
                .containsExactly(tuple(DeliveryType.PACKAGE_ADOPT, requestId, MAC, caskRef, BUNDLE_ID),
                        tuple(DeliveryType.PACKAGE_ADOPT, requestId, OTHER_MAC, caskRef, BUNDLE_ID));
    }

    @Test
    void dispatchAdopt_chocoPackage_orderCarriesThePackageId() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        RunningExecutionRows chocoRows = rows.toBuilder()
                .machineIds(List.of("win-1"))
                .packageManager(PackageManagerType.CHOCO)
                .packageName("googlechrome")
                .build();
        PackageReference chocoRef = PackageReference.builder()
                .manager(PackageManagerType.CHOCO)
                .id("googlechrome")
                .build();

        // execution
        service.dispatchAdopt(chocoRows, null, SOFTWARE_ID, null);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getPackageRef()).isEqualTo(chocoRef);
    }

    @Test
    void dispatchAdopt_reachabilityLeftToTheCaller_noRouteChecked() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        service.dispatchAdopt(rows, BrewPackageType.CASK, SOFTWARE_ID, BUNDLE_ID);

        // verifications
        verify(deliveryRouter, never()).reachable(any(DeliveryType.class), anyCollection());
    }
}
