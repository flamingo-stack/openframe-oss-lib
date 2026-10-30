package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PackageAutoUpdateRetryWithdrawalTest {

    @Mock private DeliveryTracker deliveryTracker;

    @InjectMocks private PackageAutoUpdateRetryWithdrawal withdrawal;

    @Test
    void policyNamesARetry_itsRowIsCancelled() {
        withdrawal.withdraw(PackageAutoUpdatePolicy.builder().machineId("m1").retryRequestId("req-1").build(), "turned off");

        verify(deliveryTracker).cancel(DeliveryType.PACKAGE_UPDATE, "req-1", "m1", "turned off");
    }

    @Test
    void policyNamesNoRetry_nothingIsCancelled() {
        withdrawal.withdraw(PackageAutoUpdatePolicy.builder().machineId("m1").build(), "turned off");

        verifyNoInteractions(deliveryTracker);
    }
}
