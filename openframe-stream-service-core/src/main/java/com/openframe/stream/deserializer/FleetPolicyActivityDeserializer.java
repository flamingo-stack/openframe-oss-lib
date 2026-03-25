package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.model.enums.MessageType;
import com.openframe.sdk.fleetmdm.model.Policy;
import com.openframe.stream.mapping.FleetActivityTypeMapping;
import com.openframe.stream.service.FleetMdmCacheService;
import com.openframe.stream.util.TimestampParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@Slf4j
public class FleetPolicyActivityDeserializer extends IntegratedToolEventDeserializer {

    private static final String FIELD_AGENT_ID = "agentId";
    private static final String FIELD_ACTIVITY_TYPE = "activity_type";
    private static final String FIELD_ID = "id";
    private static final String FIELD_DETAILS = "details";
    private static final String FIELD_CREATED_AT = "created_at";

    private final FleetMdmCacheService fleetMdmCacheService;

    protected FleetPolicyActivityDeserializer(ObjectMapper mapper, FleetMdmCacheService fleetMdmCacheService) {
        super(mapper, List.of(), List.of());
        this.fleetMdmCacheService = fleetMdmCacheService;
    }

    @Override
    public MessageType getType() {
        return MessageType.FLEET_MDM_POLICY_ACTIVITY_EVENT;
    }

    @Override
    protected Optional<String> getAgentId(JsonNode after) {
        return parseStringField(after, FIELD_AGENT_ID);
    }

    @Override
    protected Optional<String> getSourceEventType(JsonNode after) {
        return parseStringField(after, FIELD_ACTIVITY_TYPE);
    }

    @Override
    protected Optional<String> getEventToolId(JsonNode after) {
        return parseStringField(after, FIELD_ID);
    }

    @Override
    protected Optional<String> getMessage(JsonNode after) {
        Optional<String> activityType = getSourceEventType(after);

        // Try to get policy name from details
        String policyName = getPolicyName(after);

        if (activityType.isPresent()) {
            Optional<String> baseMessage = FleetActivityTypeMapping.getMessage(activityType.get());
            if (baseMessage.isPresent() && policyName != null) {
                return Optional.of(String.format("%s '%s'", baseMessage.get(), policyName));
            }
            if (baseMessage.isPresent()) {
                return baseMessage;
            }
        }

        return parseStringField(after, FIELD_DETAILS);
    }

    @Override
    protected Optional<Long> getSourceEventTimestamp(JsonNode afterField) {
        return parseStringField(afterField, FIELD_CREATED_AT)
                .flatMap(TimestampParser::parseIso8601);
    }

    @Override
    protected String getResult(JsonNode after) {
        Policy policyInfo = getPolicyInfo(after);
        if (policyInfo == null) {
            return null;
        }

        try {
            ObjectNode resultJson = mapper.createObjectNode();
            if (policyInfo.getName() != null) {
                resultJson.put("policy_name", policyInfo.getName());
            }
            if (policyInfo.getQuery() != null) {
                resultJson.put("query", policyInfo.getQuery());
            }
            if (policyInfo.getResolution() != null) {
                resultJson.put("resolution", policyInfo.getResolution());
            }
            if (policyInfo.getDescription() != null) {
                resultJson.put("description", policyInfo.getDescription());
            }
            if (policyInfo.getPlatform() != null) {
                resultJson.put("platform", policyInfo.getPlatform());
            }
            if (policyInfo.getCritical() != null) {
                resultJson.put("critical", policyInfo.getCritical());
            }
            return mapper.writeValueAsString(resultJson);
        } catch (Exception e) {
            log.error("Failed to create policy result JSON", e);
            return null;
        }
    }

    @Override
    protected String getDetails(JsonNode after) {
        return parseStringField(after, FIELD_DETAILS).orElse(null);
    }

    private String getPolicyName(JsonNode after) {
        // First try to extract from activity details JSON
        String detailsStr = parseStringField(after, FIELD_DETAILS).orElse(null);
        if (detailsStr != null) {
            try {
                JsonNode detailsNode = mapper.readTree(detailsStr);
                JsonNode nameNode = detailsNode.get("policy_name");
                if (nameNode != null && !nameNode.isNull()) {
                    return nameNode.asText();
                }
            } catch (Exception e) {
                log.debug("Could not parse details JSON for policy name: {}", detailsStr);
            }
        }

        // Fall back to cache lookup
        Policy policyInfo = getPolicyInfo(after);
        return policyInfo != null ? policyInfo.getName() : null;
    }

    private Policy getPolicyInfo(JsonNode after) {
        Long policyId = extractPolicyId(after);
        if (policyId == null) {
            return null;
        }

        try {
            Policy policy = fleetMdmCacheService.getPolicyById(policyId);
            if (policy == null) {
                log.debug("Policy not found in cache for policy_id: {}", policyId);
            }
            return policy;
        } catch (Exception e) {
            log.error("Error fetching policy info for policy_id: {}", policyId, e);
            return null;
        }
    }

    private Long extractPolicyId(JsonNode after) {
        // Try to extract policy_id from details JSON
        String detailsStr = parseStringField(after, FIELD_DETAILS).orElse(null);
        if (detailsStr != null) {
            try {
                JsonNode detailsNode = mapper.readTree(detailsStr);
                JsonNode policyIdNode = detailsNode.get("policy_id");
                if (policyIdNode != null && !policyIdNode.isNull()) {
                    return policyIdNode.asLong();
                }
            } catch (Exception e) {
                log.debug("Could not parse details JSON for policy_id: {}", detailsStr);
            }
        }
        return null;
    }
}
