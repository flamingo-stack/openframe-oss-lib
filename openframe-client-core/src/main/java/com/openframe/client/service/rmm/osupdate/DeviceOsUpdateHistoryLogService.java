package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.publisher.EventLogsPublisher;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.OsUpdateHistoryEvent;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DeviceOsUpdateHistoryLogService {

    private static final String OPERATION_CREATE = "c";
    private static final Map<String, Object> LOG_EVENT_HEADERS =
            Map.of(KafkaHeader.MESSAGE_TYPE_HEADER, MessageType.OS_UPDATE_HISTORY_EVENT.name());

    private final EventLogsPublisher eventLogsPublisher;
    private final ObjectMapper objectMapper;

    // The stored history expires; the log keeps every install. An entry whose operation or result the
    // backend does not know is not logged: the log would have to guess whether it succeeded.
    public void logNewEntries(List<DeviceOsUpdateHistoryEntry> newHistoryEntries) {
        newHistoryEntries.stream()
                .filter(DeviceOsUpdateHistoryLogService::isOutcomeKnown)
                .forEach(this::publishLogEvent);
    }

    private static boolean isOutcomeKnown(DeviceOsUpdateHistoryEntry historyEntry) {
        return historyEntry.getOperation() != null && historyEntry.getResult() != null;
    }

    private void publishLogEvent(DeviceOsUpdateHistoryEntry historyEntry) {
        OsUpdateHistoryEvent osUpdateHistoryEvent = toEvent(historyEntry);
        CommonDebeziumMessage logEvent = toDebeziumMessage(osUpdateHistoryEvent);
        eventLogsPublisher.publish(historyEntry.getMachineId(), logEvent, LOG_EVENT_HEADERS);
    }

    private static OsUpdateHistoryEvent toEvent(DeviceOsUpdateHistoryEntry historyEntry) {
        OsUpdateHistoryEvent osUpdateHistoryEvent = new OsUpdateHistoryEvent();
        osUpdateHistoryEvent.setTenantId(historyEntry.getTenantId());
        osUpdateHistoryEvent.setMachineId(historyEntry.getMachineId());
        osUpdateHistoryEvent.setEntryKey(historyEntry.getEntryKey());
        osUpdateHistoryEvent.setIdentifier(historyEntry.getIdentifier());
        osUpdateHistoryEvent.setTitle(historyEntry.getTitle());
        osUpdateHistoryEvent.setOperation(historyEntry.getOperation().name());
        osUpdateHistoryEvent.setResult(historyEntry.getResult().name());
        osUpdateHistoryEvent.setErrorCode(historyEntry.getErrorCode());
        osUpdateHistoryEvent.setInstalledAt(historyEntry.getInstalledAt().toEpochMilli());
        return osUpdateHistoryEvent;
    }

    private CommonDebeziumMessage toDebeziumMessage(OsUpdateHistoryEvent osUpdateHistoryEvent) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(objectMapper.valueToTree(osUpdateHistoryEvent));
        payload.setOperation(OPERATION_CREATE);
        payload.setTimestamp(Instant.now().toEpochMilli());

        CommonDebeziumMessage logEvent = new CommonDebeziumMessage();
        logEvent.setPayload(payload);
        return logEvent;
    }
}
