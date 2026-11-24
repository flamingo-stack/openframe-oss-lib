package com.openframe.stream.deserializer;

import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.model.enums.MessageType;
import com.openframe.stream.mapping.SourceEventTypes;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Optional;
import java.util.Set;

// One install or uninstall of an OS update, reported by the device in its update history, as a log event.
// The fields are those of OsUpdateHistoryEvent.
@Component
@Slf4j
public class OsUpdateHistoryEventDeserializer extends IntegratedToolEventDeserializer {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_ENTRY_KEY = "entryKey";
    private static final String FIELD_IDENTIFIER = "identifier";
    private static final String FIELD_TITLE = "title";
    private static final String FIELD_OPERATION = "operation";
    private static final String FIELD_RESULT = "result";
    private static final String FIELD_ERROR_CODE = "errorCode";
    private static final String FIELD_INSTALLED_AT = "installedAt";

    private static final String DETAILS_IDENTIFIER = "identifier";
    private static final String DETAILS_OPERATION = "operation";
    private static final String DETAILS_RESULT = "result";
    private static final String DETAILS_ERROR_CODE = "error_code";

    private static final String UNTITLED_UPDATE = "an OS update";

    private static final Set<String> FAILED_RESULTS = Set.of(
            OsUpdateInstallResult.FAILED.name(),
            OsUpdateInstallResult.ABORTED.name());

    public OsUpdateHistoryEventDeserializer(ObjectMapper mapper) {
        super(mapper, List.of(), List.of());
    }

    @Override
    public MessageType getType() {
        return MessageType.OS_UPDATE_HISTORY_EVENT;
    }

    @Override
    protected Optional<String> getTenantId(JsonNode after) {
        return parseStringField(after, FIELD_TENANT_ID);
    }

    @Override
    protected Optional<String> getAgentId(JsonNode after) {
        return parseStringField(after, FIELD_MACHINE_ID);
    }

    @Override
    protected Optional<String> getSourceEventType(JsonNode after) {
        boolean failed = isFailed(after);
        if (isUninstall(after)) {
            return Optional.of(failed
                    ? SourceEventTypes.Rmm.OS_UPDATE_UNINSTALL_FAILED
                    : SourceEventTypes.Rmm.OS_UPDATE_UNINSTALLED);
        }
        return Optional.of(failed
                ? SourceEventTypes.Rmm.OS_UPDATE_INSTALL_FAILED
                : SourceEventTypes.Rmm.OS_UPDATE_INSTALLED);
    }

    // The same install is the same log event, however many times it is published.
    @Override
    protected Optional<String> getEventToolId(JsonNode after) {
        Optional<String> entryKey = parseStringField(after, FIELD_ENTRY_KEY);
        return parseStringField(after, FIELD_MACHINE_ID)
                .flatMap(machineId -> entryKey.map(key -> machineId + ":" + key));
    }

    @Override
    protected Optional<String> getMessage(JsonNode after) {
        String title = parseStringField(after, FIELD_TITLE).orElse(UNTITLED_UPDATE);
        String action = isUninstall(after) ? "uninstall" : "install";
        if (!isFailed(after)) {
            return Optional.of("OS update %sed: %s".formatted(action, title));
        }
        String errorCode = parseStringField(after, FIELD_ERROR_CODE)
                .map(" (%s)"::formatted)
                .orElse("");
        return Optional.of("OS update failed to %s: %s%s".formatted(action, title, errorCode));
    }

    // When the device installed it, not when it reported it.
    @Override
    protected Optional<Long> getSourceEventTimestamp(JsonNode after) {
        return parseStringField(after, FIELD_INSTALLED_AT).map(Long::parseLong);
    }

    @Override
    protected String getDetails(JsonNode after) {
        ObjectNode details = mapper.createObjectNode();
        parseStringField(after, FIELD_IDENTIFIER).ifPresent(value -> details.put(DETAILS_IDENTIFIER, value));
        parseStringField(after, FIELD_OPERATION).ifPresent(value -> details.put(DETAILS_OPERATION, value));
        parseStringField(after, FIELD_RESULT).ifPresent(value -> details.put(DETAILS_RESULT, value));
        parseStringField(after, FIELD_ERROR_CODE).ifPresent(value -> details.put(DETAILS_ERROR_CODE, value));
        return details.isEmpty() ? null : details.toString();
    }

    private boolean isUninstall(JsonNode after) {
        return parseStringField(after, FIELD_OPERATION)
                .map(OsUpdateOperation.UNINSTALL.name()::equals)
                .orElse(false);
    }

    private boolean isFailed(JsonNode after) {
        return parseStringField(after, FIELD_RESULT)
                .map(FAILED_RESULTS::contains)
                .orElse(false);
    }
}
