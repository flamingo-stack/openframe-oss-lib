package com.openframe.client.event;

import com.openframe.data.document.device.Machine;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Published when a device transitions from PENDING to ONLINE (first heartbeat received).
 * Used by SaaS layer to trigger DEVICE_REGISTERED event.
 */
@Getter
public class DeviceFirstConnectedEvent extends ApplicationEvent {

    private final Machine machine;

    public DeviceFirstConnectedEvent(Object source, Machine machine) {
        super(source);
        this.machine = machine;
    }
}
