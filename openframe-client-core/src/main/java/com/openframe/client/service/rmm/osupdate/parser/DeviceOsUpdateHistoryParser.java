package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@RequiredArgsConstructor
public class DeviceOsUpdateHistoryParser {

    private static final long HRESULT_SUCCESS = 0;
    private static final long UNSIGNED_32_BITS = 0xFFFFFFFFL;

    private final ReportedEnumParser reportedEnumParser;

    // Only Windows reports a history. A Mac's block has none. One entry per entry key: an install the report
    // names twice is one entry.
    public List<DeviceOsUpdateHistoryEntry> parse(ReportingDevice reportingDevice,
                                                  MachineOsUpdatesMessage.WindowsDetails windows) {
        if (windows == null || windows.getHistory() == null) {
            return List.of();
        }
        Map<String, DeviceOsUpdateHistoryEntry> entriesByEntryKey = new LinkedHashMap<>();
        windows.getHistory().stream()
                .filter(DeviceOsUpdateHistoryParser::isIdentified)
                .map(reportedEntry -> parse(reportingDevice, reportedEntry))
                .forEach(historyEntry -> entriesByEntryKey.putIfAbsent(historyEntry.getEntryKey(), historyEntry));
        return List.copyOf(entriesByEntryKey.values());
    }

    private static boolean isIdentified(MachineOsUpdatesMessage.WindowsHistoryEntry reportedEntry) {
        return reportedEntry != null
                && isNotBlank(reportedEntry.getUpdateId())
                && reportedEntry.getInstalledAt() != null;
    }

    private DeviceOsUpdateHistoryEntry parse(ReportingDevice reportingDevice,
                                             MachineOsUpdatesMessage.WindowsHistoryEntry reportedEntry) {
        String identifier = parseIdentifier(reportedEntry);
        OsUpdateOperation operation = reportedEnumParser.parse(OsUpdateOperation.class, reportedEntry.getOperation());
        return DeviceOsUpdateHistoryEntry.builder()
                .tenantId(reportingDevice.getTenantId())
                .machineId(reportingDevice.getMachineId())
                .organizationId(reportingDevice.getOrganizationId())
                .entryKey(parseEntryKey(identifier, reportedEntry, operation))
                .identifier(identifier)
                .title(reportedEntry.getTitle())
                .installedAt(reportedEntry.getInstalledAt())
                .operation(operation)
                .result(reportedEnumParser.parse(OsUpdateInstallResult.class, reportedEntry.getResultCode()))
                .errorCode(parseErrorCode(reportedEntry.getHresult()))
                .build();
    }

    // Same form as the identifier of a pending Windows update: UpdateID:RevisionNumber.
    private static String parseIdentifier(MachineOsUpdatesMessage.WindowsHistoryEntry reportedEntry) {
        if (reportedEntry.getRevision() == null) {
            return reportedEntry.getUpdateId();
        }
        return reportedEntry.getUpdateId() + ":" + reportedEntry.getRevision();
    }

    // The operation as the backend knows it, so "install" and "INSTALL" of one install are one entry.
    private static String parseEntryKey(String identifier, MachineOsUpdatesMessage.WindowsHistoryEntry reportedEntry,
                                        OsUpdateOperation operation) {
        long installedAtMillis = reportedEntry.getInstalledAt().toEpochMilli();
        String operationKey = operation != null ? operation.name() : reportedEntry.getOperation();
        return identifier + "|" + installedAtMillis + "|" + operationKey;
    }

    private static String parseErrorCode(Long hresult) {
        if (hresult == null || hresult == HRESULT_SUCCESS) {
            return null;
        }
        return String.format("0x%08X", hresult & UNSIGNED_32_BITS);
    }
}
