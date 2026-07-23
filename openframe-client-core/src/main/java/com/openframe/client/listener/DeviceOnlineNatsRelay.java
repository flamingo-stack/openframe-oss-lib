package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.model.DeviceOnlineEvent;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Relays the in-JVM {@link DeviceCameOnlineEvent} to the management service over core NATS on
 * {@link DeviceOnlineEvent#SUBJECT}. Keeps {@code MachineStatusService} free of any NATS
 * dependency and only wires up where the stream/NATS stack is enabled.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class DeviceOnlineNatsRelay {

    private final NatsMessagePublisher natsMessagePublisher;

    @EventListener
    public void onDeviceCameOnline(DeviceCameOnlineEvent event) {
        Machine machine = event.getMachine();
        DeviceOnlineEvent payload = DeviceOnlineEvent.builder()
                .tenantId(machine.getTenantId())
                .machineId(machine.getMachineId())
                .occurredAt(machine.getLastSeen())
                .build();
        natsMessagePublisher.publish(DeviceOnlineEvent.SUBJECT, payload);
        log.debug("Relayed device-online to NATS: machineId={} subject={}",
                machine.getMachineId(), DeviceOnlineEvent.SUBJECT);
    }
}
