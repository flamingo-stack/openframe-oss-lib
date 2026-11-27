package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DeviceOsPendingUpdateParser {

    private final ReportedEnumParser reportedEnumParser;

    public List<DeviceOsPendingUpdate> parse(ReportingDevice reportingDevice,
                                             List<MachineOsUpdatesMessage.UpdateItem> items) {
        return items.stream()
                .map(item -> parse(reportingDevice, item))
                .toList();
    }

    private DeviceOsPendingUpdate parse(ReportingDevice reportingDevice, MachineOsUpdatesMessage.UpdateItem item) {
        MachineOsUpdatesMessage.WindowsUpdate windows = item.getWindows();
        MachineOsUpdatesMessage.MacosUpdate macos = item.getMacos();
        Boolean downloaded = windows != null ? windows.getIsDownloaded() : null;
        String macosPresence = macos != null ? macos.getPresence() : null;
        return DeviceOsPendingUpdate.builder()
                .tenantId(reportingDevice.getTenantId())
                .machineId(reportingDevice.getMachineId())
                .organizationId(reportingDevice.getOrganizationId())
                .platform(reportingDevice.getPlatform())
                .identifier(item.getIdentifier())
                .discoveredAt(reportingDevice.getReceivedAt())
                .downloaded(downloaded)
                .macosPresence(reportedEnumParser.parse(MacosUpdatePresence.class, macosPresence))
                .build();
    }
}
