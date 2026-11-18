package com.openframe.client.listener.packageadopt;

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
class PackageAdoptDeliveryFailureListenerTest {

    private static final String REQUEST_ID = "req-1";
    private static final String MACHINE_ID = "m1";

    @Mock private PackageAdoptStatusProcessor packageAdoptStatusProcessor;

    @InjectMocks private PackageAdoptDeliveryFailureListener listener;

    @Test
    void onDeliveryFailed_adoptOrderNotDelivered_adoptionOfThatRequestFailed() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID, DeliveryFailure.EXHAUSTED);

        // execution
        listener.onDeliveryFailed(event);

        // verifications
        verify(packageAdoptStatusProcessor).failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.EXHAUSTED);
    }

    @Test
    void onDeliveryFailed_otherDeliveryType_ignored() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_UPDATE, REQUEST_ID, MACHINE_ID, DeliveryFailure.EXHAUSTED);

        // execution
        listener.onDeliveryFailed(event);

        // verifications
        verifyNoInteractions(packageAdoptStatusProcessor);
    }

    @Test
    void onDeliveryFailed_markingFails_failureStaysHere() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID, DeliveryFailure.TIMEOUT);
        IllegalStateException mongoDown = new IllegalStateException("mongo down");
        doThrow(mongoDown).when(packageAdoptStatusProcessor).failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.TIMEOUT);

        // execution and verifications
        assertThatCode(() -> listener.onDeliveryFailed(event)).doesNotThrowAnyException();
    }
}
