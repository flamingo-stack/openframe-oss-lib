package com.openframe.client.event;

import com.openframe.data.document.device.Machine;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Published when a device transitions from OFFLINE to ONLINE (a reconnect, not a first
 * connection — that is {@link DeviceFirstConnectedEvent}). Relayed to the management service over
 * NATS to fire the machine's DEVICE_ONLINE-triggered schedules.
 */
@Getter
public class DeviceCameOnlineEvent extends ApplicationEvent {

    private final Machine machine;

    public DeviceCameOnlineEvent(Object source, Machine machine) {
        super(source);
        this.machine = machine;
    }
}
