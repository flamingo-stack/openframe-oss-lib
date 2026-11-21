package com.openframe.data.nats.delivery.route;

import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.function.BooleanSupplier;

import static com.openframe.data.document.audit.AuditAction.DEVICE_CLIENT_UPDATE;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceCommandSenderTest {

    private static final String MACHINE_ID = "mach-42";
    private static final Map<String, Object> DETAILS = Map.of("version", "1.5.40");

    @Mock private DeliveryRouter deliveryRouter;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private DeviceCommandSender sender;

    @Test
    void send_routeCarriesIt_sentWithoutARefusal() {
        ClientUninstallDeliverySeed seed = new ClientUninstallDeliverySeed(MACHINE_ID);
        runTheWork(MACHINE_ID);
        when(deliveryRouter.dispatch(seed)).thenReturn(true);

        boolean sent = sender.send(DEVICE_CLIENT_UPDATE, MACHINE_ID, DETAILS, () -> seed);

        assertThat(sent).isTrue();
        verifyNoInteractions(auditRecorder);
    }

    @Test
    void send_noRouteReachesTheMachine_recordsThatItsAgentCannotReceiveIt() {
        ClientUninstallDeliverySeed seed = new ClientUninstallDeliverySeed(MACHINE_ID);
        runTheWork(MACHINE_ID);
        when(deliveryRouter.dispatch(seed)).thenReturn(false);

        boolean sent = sender.send(DEVICE_CLIENT_UPDATE, MACHINE_ID, DETAILS, () -> seed);

        assertThat(sent).isFalse();
        assertThat(recordedRefusal())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetType, AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(DEVICE_CLIENT_UPDATE, AuditOutcome.REFUSED,
                        "the device's agent cannot receive this command", DEVICE, MACHINE_ID, DETAILS);
    }

    @Test
    void send_noRouteCarriesItToEveryMachine_recordsARefusalForNoDevice() {
        ClientUninstallDeliverySeed seed = new ClientUninstallDeliverySeed(MACHINE_ID);
        runTheWork(null);
        when(deliveryRouter.dispatch(seed)).thenReturn(false);

        sender.send(DEVICE_CLIENT_UPDATE, null, DETAILS, () -> seed);

        assertThat(recordedRefusal())
                .extracting(AuditEntry::getReason, AuditEntry::getTargetId)
                .containsExactly("no delivery route carries this command to every machine", null);
    }

    private void runTheWork(String machineId) {
        when(auditedMethodRunner.runWhenChanged(eq(DEVICE_CLIENT_UPDATE), eq(DEVICE), eq(machineId), eq(DETAILS), any()))
                .thenAnswer(invocation -> invocation.<BooleanSupplier>getArgument(4).getAsBoolean());
    }

    private AuditEntry recordedRefusal() {
        ArgumentCaptor<AuditEntry> entry = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).record(entry.capture());
        return entry.getValue();
    }
}
