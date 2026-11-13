package com.openframe.client.event;

import com.openframe.data.document.device.Machine;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

// Published once per registration: on the promotion PENDING -> MANAGED with the managed-status flag on, or on the first
// connect PENDING -> ONLINE/OFFLINE with it off. The SaaS layer turns it into DEVICE_REGISTERED.
@Getter
public class DeviceFirstConnectedEvent extends ApplicationEvent {

    private final Machine machine;

    public DeviceFirstConnectedEvent(Object source, Machine machine) {
        super(source);
        this.machine = machine;
    }
}
