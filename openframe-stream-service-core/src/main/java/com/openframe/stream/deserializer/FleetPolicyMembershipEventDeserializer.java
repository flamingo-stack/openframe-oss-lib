package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.model.enums.MessageType;
import com.openframe.sdk.fleetmdm.model.Policy;
import com.openframe.stream.service.FleetMdmCacheService;
import com.openframe.stream.util.TimestampParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

import static com.openframe.stream.mapping.SourceEventTypes.Fleet.POLICY_MEMBERSHIP_FAIL;
import static com.openframe.stream.mapping.SourceEventTypes.Fleet.POLICY_MEMBERSHIP_PASS;

@Component
@Slf4j
public class FleetPolicyMembershipEventDeserializer extends IntegratedToolEventDeserializer {

    private final FleetMdmCacheService fleetMdmCacheService;

    protected FleetPolicyMembershipEventDeserializer(ObjectMapper mapper, FleetMdmCacheService fleetMdmCacheService) {
        super(mapper, List.of(), List.of());
        this.fleetMdmCacheService = fleetMdmCacheService;
    }

    @Override
    public MessageType getType() {
        return MessageType.FLEET_MDM_POLICY_MEMBERSHIP_EVENT;
    }

    @Override
    protected Optional<String> getAgentId(JsonNode afterField) {
        return Optional.ofNullable(afterField.get("host_id"))
                .map(JsonNode::asText);
    }

    @Override
    protected Optional<String> getSourceEventType(JsonNode afterField) {
        JsonNode passesNode = afterField.get("passes");
        if (passesNode == null || passesNode.isNull()) {
            return Optional.of(POLICY_MEMBERSHIP_FAIL);
        }
        boolean passes = passesNode.asBoolean(false);
        return Optional.of(passes ? POLICY_MEMBERSHIP_PASS : POLICY_MEMBERSHIP_FAIL);
    }

    @Override
    protected Optional<String> getEventToolId(JsonNode afterField) {
        // Composite ID from policy_id and host_id
        JsonNode policyIdNode = afterField.get("policy_id");
        JsonNode hostIdNode = afterField.get("host_id");
        if (policyIdNode != null && hostIdNode != null) {
            return Optional.of(policyIdNode.asText() + "_" + hostIdNode.asText());
        }
        return Optional.empty();
    }

    @Override
    protected Optional<String> getMessage(JsonNode afterField) {
        boolean passes = isPassing(afterField);
        String passFailText = passes ? "passed" : "failed";

        return getPolicyInfo(afterField)
                .map(Policy::getName)
                .map(name -> String.format("Policy '%s' %s on host", name, passFailText))
                .or(() -> Optional.of(String.format("Policy membership check %s", passFailText)));
    }

    @Override
    protected Optional<Long> getSourceEventTimestamp(JsonNode afterField) {
        return parseStringField(afterField, "updated_at")
                .or(() -> parseStringField(afterField, "created_at"))
                .flatMap(TimestampParser::parseIso8601);
    }

    @Override
    protected String getResult(JsonNode after) {
        return isPassing(after) ? buildPolicyDetailsJson(after) : null;
    }

    @Override
    protected String getError(JsonNode after) {
        return isPassing(after) ? null : buildPolicyDetailsJson(after);
    }

    @Override
    protected String getDetails(JsonNode after) {
        return null;
    }

    private boolean isPassing(JsonNode afterField) {
        JsonNode passesNode = afterField.get("passes");
        return passesNode != null && !passesNode.isNull() && passesNode.asBoolean(false);
    }

    private String buildPolicyDetailsJson(JsonNode after) {
        try {
            ObjectNode detailsJson = mapper.createObjectNode();

            getPolicyInfo(after).ifPresent(policy -> {
                putIfPresent(detailsJson, "policy_name", policy.getName());
                putIfPresent(detailsJson, "query", policy.getQuery());
                putIfPresent(detailsJson, "resolution", policy.getResolution());
                putIfPresent(detailsJson, "description", policy.getDescription());
                putIfPresent(detailsJson, "critical", policy.getCritical());
            });

            Optional.ofNullable(after.get("policy_id"))
                    .filter(node -> !node.isNull())
                    .ifPresent(node -> detailsJson.put("policy_id", node.asInt()));

            Optional.ofNullable(after.get("automation_iteration"))
                    .filter(node -> !node.isNull())
                    .ifPresent(node -> detailsJson.put("automation_iteration", node.asInt()));

            return mapper.writeValueAsString(detailsJson);
        } catch (Exception e) {
            log.error("Failed to create policy details JSON", e);
            return null;
        }
    }

    private Optional<Policy> getPolicyInfo(JsonNode afterField) {
        return Optional.ofNullable(afterField.get("policy_id"))
                .filter(node -> !node.isNull())
                .map(JsonNode::asLong)
                .flatMap(fleetMdmCacheService::getPolicyById);
    }
}
