package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.track.DeliveryFailedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PackageUpdateDeliveryFailureListenerTest {

    @Mock private PackageUpdateStatusProcessor processor;

    @InjectMocks private PackageUpdateDeliveryFailureListener listener;

    @Test
    void packageUpdateOrderNotDelivered_closesTheDevice() {
        listener.onDeliveryFailed(new DeliveryFailedEvent(DeliveryType.PACKAGE_UPDATE, "req-1", "m1", DeliveryFailure.EXHAUSTED));

        verify(processor).failUndelivered("m1", "req-1", DeliveryFailure.EXHAUSTED);
    }

    @Test
    void deadlineForceNotDelivered_deviceLeftAlone() {
        listener.onDeliveryFailed(new DeliveryFailedEvent(DeliveryType.PACKAGE_UPDATE, "req-1:deadline", "m1", DeliveryFailure.OFFLINE));

        verifyNoInteractions(processor);
    }

    @Test
    void otherDeliveryType_ignored() {
        listener.onDeliveryFailed(new DeliveryFailedEvent(DeliveryType.CLIENT_UPDATE, "openframe-client", "m1", DeliveryFailure.EXHAUSTED));

        verifyNoInteractions(processor);
    }

    @Test
    void closingFails_failureStaysHere() {
        doThrow(new IllegalStateException("mongo down")).when(processor).failUndelivered("m1", "req-1", DeliveryFailure.TIMEOUT);

        assertThatCode(() -> listener.onDeliveryFailed(
                new DeliveryFailedEvent(DeliveryType.PACKAGE_UPDATE, "req-1", "m1", DeliveryFailure.TIMEOUT)))
                .doesNotThrowAnyException();
    }
}
