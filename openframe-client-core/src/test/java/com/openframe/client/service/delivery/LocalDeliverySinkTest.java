package com.openframe.client.service.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.delivery.dispatch.DeliveryPublisher;
import com.openframe.delivery.dispatch.DeliveryRecorder;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocalDeliverySinkTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String SUBJECT = "machine.mach-42.tool-installation";

    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryRecorder recorder;
    @Mock private DeliveryPublisher publisher;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;

    @InjectMocks private LocalDeliverySink sink;

    private ToolInstallationMessage payload;
    private DeliveryRequest<ToolInstallationMessage> request;

    @BeforeEach
    void setUp() {
        payload = new ToolInstallationMessage();
        payload.setDelivery(new DeliveryRef(DeliveryType.TOOL_INSTALLATION, TARGET_ID, "d-1"));
        request = DeliveryRequest.<ToolInstallationMessage>builder()
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .payload(payload)
                .build();
    }

    @Test
    void accept_newDispatch_rowRecordedThenPublishedToSpecSubject() {
        // setup
        when(recorder.record(request)).thenReturn(true);
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        when(spec.subject(MACHINE_ID)).thenReturn(SUBJECT);

        // execution
        sink.accept(request);

        // verifications
        verify(publisher).publish(SUBJECT, payload);
        verify(metrics).recordDispatched(DeliveryType.TOOL_INSTALLATION, "local");
    }

    @Test
    void accept_replayedHandOff_nothingPublished() {
        // setup
        when(recorder.record(request)).thenReturn(false);

        // execution
        sink.accept(request);

        // verifications
        verifyNoInteractions(publisher, registry);
        verify(metrics).recordDispatchDuplicate(DeliveryType.TOOL_INSTALLATION);
    }
}
