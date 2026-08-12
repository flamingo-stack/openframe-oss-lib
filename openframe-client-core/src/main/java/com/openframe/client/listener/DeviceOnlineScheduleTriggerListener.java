package com.openframe.client.listener;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerListener {

    private final DeviceOnlineScheduleTriggerService triggerService;

    @EventListener
    public void onDeviceCameOnline(DeviceCameOnlineEvent event) {
        triggerService.onDeviceOnline(event.getMachine());
    }
}
