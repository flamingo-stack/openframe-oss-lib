package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.exception.MalformedDeviceOsReportException;
import com.openframe.client.service.rmm.osupdate.DeviceOsReport;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DeviceOsReportParser {

    private final ObjectMapper objectMapper;
    private final ReportedEnumParser reportedEnumParser;
    private final DeviceOsStateParser deviceOsStateParser;
    private final ReportedPendingUpdatesParser reportedPendingUpdatesParser;
    private final OsUpdateParser osUpdateParser;
    private final DeviceOsPendingUpdateParser deviceOsPendingUpdateParser;
    private final DeviceOsUpdateHistoryParser deviceOsUpdateHistoryParser;

    public DeviceOsReport parse(Machine machine, byte[] payload, Instant receivedAt) {
        MachineOsUpdatesMessage message = readMessage(payload);
        ReportingDevice reportingDevice = toReportingDevice(machine, message, receivedAt);

        DeviceOsState deviceOsState = deviceOsStateParser.parse(reportingDevice, message);
        boolean pendingUpdatesReadable = reportedPendingUpdatesParser.isReadable(message.getUpdates());
        List<MachineOsUpdatesMessage.UpdateItem> pendingItems = reportedPendingUpdatesParser.parse(message.getUpdates());
        List<OsUpdate> osUpdates = osUpdateParser.parse(reportingDevice, pendingItems);
        List<DeviceOsPendingUpdate> pendingUpdates = deviceOsPendingUpdateParser.parse(reportingDevice, pendingItems);
        List<DeviceOsUpdateHistoryEntry> historyEntries =
                deviceOsUpdateHistoryParser.parse(reportingDevice, message.getWindows());

        return DeviceOsReport.builder()
                .deviceOsState(deviceOsState)
                .pendingUpdatesReadable(pendingUpdatesReadable)
                .osUpdates(osUpdates)
                .pendingUpdates(pendingUpdates)
                .historyEntries(historyEntries)
                .build();
    }

    private MachineOsUpdatesMessage readMessage(byte[] payload) {
        try {
            MachineOsUpdatesMessage message = objectMapper.readValue(payload, MachineOsUpdatesMessage.class);
            if (message == null) {
                throw new MalformedDeviceOsReportException("OS report is empty");
            }
            return message;
        } catch (JacksonException unreadable) {
            throw new MalformedDeviceOsReportException("OS report is not readable JSON", unreadable);
        }
    }

    private ReportingDevice toReportingDevice(Machine machine, MachineOsUpdatesMessage message, Instant receivedAt) {
        OsPlatform platform = reportedEnumParser.parse(OsPlatform.class, message.getPlatform());
        if (platform == null) {
            throw new MalformedDeviceOsReportException("OS report names no known platform: " + message.getPlatform());
        }
        return ReportingDevice.builder()
                .tenantId(machine.getTenantId())
                .machineId(machine.getMachineId())
                .platform(platform)
                .receivedAt(receivedAt)
                .build();
    }
}
