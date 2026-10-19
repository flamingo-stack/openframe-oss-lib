package com.openframe.client.event;

import com.openframe.data.document.device.Machine;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Published when an agent deregisters itself on uninstall and its machine is marked DELETED.
 * Used by SaaS layer to trigger DEVICE_DELETED event, the same one an API status change sends.
 */
@Getter
public class DeviceUninstalledEvent extends ApplicationEvent {

    private final Machine machine;

    public DeviceUninstalledEvent(Object source, Machine machine) {
        super(source);
        this.machine = machine;
    }
}
