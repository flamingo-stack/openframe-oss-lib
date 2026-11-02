package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PackageAutoUpdateRetryTest {

    private static final String TENANT = "t1";
    private static final String VERSION = "152.0.7977.65";
    private static final long BACKOFF_SECONDS = 21_600;

    @Mock private PackageAutoUpdatePolicyRepository policyRepository;
    @Mock private DeliveryDispatcher deliveryDispatcher;

    @InjectMocks private PackageAutoUpdateRetry retry;

    private PackageUpdateRequest request;
    private PackageAutoUpdatePolicy policy;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(retry, "maxAttempts", 3);
        ReflectionTestUtils.setField(retry, "backoffSeconds", BACKOFF_SECONDS);
        request = PackageUpdateRequest.builder()
                .tenantId(TENANT).requestId("req-1").source(PackageUpdateSource.AUTO)
                .executionId(SoftwareExecutionId.forAutoUpdate(TENANT, PackageManagerType.BREW, "google-chrome", VERSION))
                .packageManager(PackageManagerType.BREW).packageName("google-chrome").brewPackageType(BrewPackageType.CASK)
                .mode(PackageUpdateMode.FORCE).forceCountdownSeconds(60)
                .build();
        policy = PackageAutoUpdatePolicy.builder().id("p1").enabled(true).lastVersion(VERSION).build();
        when(policyRepository.findByTenantIdAndMachineIdAndPackageManagerAndPackageName(TENANT, "m1", PackageManagerType.BREW, "google-chrome"))
                .thenReturn(Optional.of(policy));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER_ERROR", "TIMEOUT", "CLOSE_FAILED", "NOT_DELIVERED"})
    void failureThatCanPass_isOrderedAgainAfterThePause(String reason) {
        PackageUpdateDeviceState state = failed(reason);
        state.setDeadlineAt(Instant.now());

        retry.scheduleIfDue(state, request);

        ArgumentCaptor<PackageUpdateDeliverySeed> seed = ArgumentCaptor.forClass(PackageUpdateDeliverySeed.class);
        ArgumentCaptor<Instant> dueAt = ArgumentCaptor.forClass(Instant.class);
        InOrder order = inOrder(policyRepository, deliveryDispatcher);
        order.verify(policyRepository).markRetryScheduled("p1", "req-1");
        order.verify(deliveryDispatcher).schedule(seed.capture(), dueAt.capture());
        assertThat(seed.getValue().getRequestId()).isEqualTo("req-1");
        assertThat(seed.getValue().getMachineId()).isEqualTo("m1");
        assertThat(seed.getValue().getMode()).isEqualTo(PackageUpdateMode.FORCE);
        assertThat(seed.getValue().getCountdownSeconds()).isEqualTo(60);
        assertThat(dueAt.getValue()).isCloseTo(Instant.now().plus(Duration.ofSeconds(BACKOFF_SECONDS)), within(Duration.ofSeconds(5)));
        assertThat(state.getRetries()).isEqualTo(1);
        assertThat(state.getDeadlineAt()).isNull();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"SUPERSEDED", "NOT_SUPPORTED", "MANAGER_MISSING", "NOT_INSTALLED", "NOT_UPGRADABLE"})
    void failureThatWillNotPass_staysFailed(String reason) {
        retry.scheduleIfDue(failed(reason), request);

        nothingScheduled();
    }

    @Test
    void lastAttemptLeft_isOrderedAgain() {
        PackageUpdateDeviceState state = failed("TIMEOUT");
        state.setRetries(1);

        retry.scheduleIfDue(state, request);

        verify(deliveryDispatcher).schedule(any(), any());
        assertThat(state.getRetries()).isEqualTo(2);
    }

    @Test
    void lastAttemptUsed_staysFailed() {
        PackageUpdateDeviceState state = failed("TIMEOUT");
        state.setRetries(2);

        retry.scheduleIfDue(state, request);

        nothingScheduled();
        assertThat(state.getRetries()).isEqualTo(2);
    }

    @Test
    void anAdminsOrder_isNotRetried() {
        request.setSource(PackageUpdateSource.ADMIN);

        retry.scheduleIfDue(failed("TIMEOUT"), request);

        nothingScheduled();
    }

    @Test
    void deviceThatDidNotFail_isLeftAlone() {
        PackageUpdateDeviceState state = failed("TIMEOUT");
        state.setStatus(SoftwareActionStatus.WAITING);

        retry.scheduleIfDue(state, request);

        nothingScheduled();
    }

    @Test
    void policyTurnedOff_noRetry() {
        policy.setEnabled(false);

        retry.scheduleIfDue(failed("TIMEOUT"), request);

        nothingScheduled();
    }

    @Test
    void noPolicy_noRetry() {
        when(policyRepository.findByTenantIdAndMachineIdAndPackageManagerAndPackageName(TENANT, "m1", PackageManagerType.BREW, "google-chrome"))
                .thenReturn(Optional.empty());

        retry.scheduleIfDue(failed("TIMEOUT"), request);

        nothingScheduled();
    }

    @Test
    void newerVersionOrdered_noRetry() {
        policy.setLastVersion("153.0.0.1");

        retry.scheduleIfDue(failed("TIMEOUT"), request);

        nothingScheduled();
    }

    @Test
    void noRequest_noRetry() {
        retry.scheduleIfDue(failed("TIMEOUT"), null);

        nothingScheduled();
    }

    private void nothingScheduled() {
        verifyNoInteractions(deliveryDispatcher);
        verify(policyRepository, never()).markRetryScheduled(any(), any());
    }

    private static PackageUpdateDeviceState failed(String reason) {
        return PackageUpdateDeviceState.builder()
                .requestId("req-1").machineId("m1").status(SoftwareActionStatus.FAILED).failedReason(reason)
                .build();
    }
}
