package com.openframe.external.service;

import com.openframe.audit.AuditCall;
import com.openframe.data.document.tool.IntegratedTool;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_LIVE_QUERY_RUN;
import static com.openframe.data.document.audit.AuditAction.TOOL_PROXY_CALL_RUN;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;
import static com.openframe.data.document.audit.AuditTargetType.INTEGRATED_TOOL;
import static org.springframework.util.StringUtils.hasText;

@Component
@RequiredArgsConstructor
public class ProxyAuditCalls {

    private static final String LIVE_QUERY_PATH_SUFFIX = "/fleet/queries/run";

    private final ObjectMapper objectMapper;

    public AuditCall of(IntegratedTool tool, String method, String path, String body) {
        Map<String, Object> details = new HashMap<>();
        details.put("method", method);
        details.put("path", path);
        if ("POST".equals(method) && path.endsWith(LIVE_QUERY_PATH_SUFFIX)) {
            addLiveQuery(details, body);
            return AuditCall.of(DEVICE_LIVE_QUERY_RUN, DEVICE, null, details);
        }
        return AuditCall.of(TOOL_PROXY_CALL_RUN, INTEGRATED_TOOL, tool.getId(), details).withCompare(false);
    }

    private void addLiveQuery(Map<String, Object> details, String body) {
        if (!hasText(body)) {
            return;
        }
        JsonNode json;
        try {
            json = objectMapper.readTree(body);
        } catch (JacksonException malformed) {
            return;
        }
        details.put("query", textOrNull(json, "query"));
        details.put("queryId", textOrNull(json, "query_id"));
        JsonNode hostIds = json.path("selected").path("host_ids");
        details.put("hostIds", hostIds.isArray() ? objectMapper.convertValue(hostIds, List.class) : null);
    }

    private static String textOrNull(JsonNode json, String field) {
        JsonNode value = json.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }
}
