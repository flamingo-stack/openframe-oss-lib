package com.openframe.data.nats.delivery.route;

import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.function.Supplier;

import static com.openframe.data.document.audit.AuditTargetType.DEVICE;

@Component
@RequiredArgsConstructor
public class DeviceCommandSender {

    public static final String UNREACHABLE = "the device's agent cannot receive this command";
    private static final String NOT_AVAILABLE_FOR_EVERY_MACHINE =
            "this command is not available for all devices at once, so it was sent to no device";

    private final DeliveryRouter deliveryRouter;
    private final AuditedMethodRunner auditedMethodRunner;
    private final AuditRecorder auditRecorder;

    public boolean send(AuditAction action, String machineId, Map<String, Object> details,
                        Supplier<DeliverySeed> command) {
        boolean sent = auditedMethodRunner.runWhenChanged(action, DEVICE, machineId, details,
                () -> deliveryRouter.dispatch(command.get()));
        if (!sent) {
            boolean everyMachine = machineId == null;
            auditRecorder.record(AuditEntry.builder()
                    .action(action)
                    .outcome(everyMachine ? AuditOutcome.FAILURE : AuditOutcome.REFUSED)
                    .reason(everyMachine ? NOT_AVAILABLE_FOR_EVERY_MACHINE : UNREACHABLE)
                    .targetType(DEVICE)
                    .targetId(machineId)
                    .details(details)
                    .build());
        }
        return sent;
    }
}
