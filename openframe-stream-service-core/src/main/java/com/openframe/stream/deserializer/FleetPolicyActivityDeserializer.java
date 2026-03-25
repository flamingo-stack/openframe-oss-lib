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
        return getPolicyInfo(after)
                .map(policy -> {
                    try {
                        ObjectNode resultJson = mapper.createObjectNode();
                        putIfPresent(resultJson, "policy_name", policy.getName());
                        putIfPresent(resultJson, "query", policy.getQuery());
                        putIfPresent(resultJson, "resolution", policy.getResolution());
                        putIfPresent(resultJson, "description", policy.getDescription());
                        putIfPresent(resultJson, "platform", policy.getPlatform());
                        putIfPresent(resultJson, "critical", policy.getCritical());
                        return mapper.writeValueAsString(resultJson);
                    } catch (Exception e) {
                        log.error("Failed to create policy result JSON", e);
                        return null;
                    }
                })
                .orElse(null);
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
        return getPolicyInfo(after)
                .map(Policy::getName)
                .orElse(null);
    }

    private Optional<Policy> getPolicyInfo(JsonNode after) {
        return extractPolicyId(after)
                .flatMap(fleetMdmCacheService::getPolicyById);
    }

    private Optional<Long> extractPolicyId(JsonNode after) {
        return parseStringField(after, FIELD_DETAILS)
                .flatMap(detailsStr -> {
                    try {
                        JsonNode detailsNode = mapper.readTree(detailsStr);
                        return Optional.ofNullable(detailsNode.get("policy_id"))
                                .filter(node -> !node.isNull())
                                .map(JsonNode::asLong);
                    } catch (Exception e) {
                        log.debug("Could not parse details JSON for policy_id: {}", detailsStr);
                        return Optional.empty();
                    }
                });
    }
}
