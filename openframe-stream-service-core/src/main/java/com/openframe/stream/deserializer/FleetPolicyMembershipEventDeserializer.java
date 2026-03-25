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
        String policyName = getPolicyName(afterField);
        JsonNode passesNode = afterField.get("passes");

        boolean passes = passesNode != null && !passesNode.isNull() && passesNode.asBoolean(false);

        if (policyName != null) {
            return Optional.of(String.format("Policy '%s' %s on host",
                    policyName, passes ? "passed" : "failed"));
        }

        return Optional.of(String.format("Policy membership check %s",
                passes ? "passed" : "failed"));
    }

    @Override
    protected Optional<Long> getSourceEventTimestamp(JsonNode afterField) {
        return parseStringField(afterField, "updated_at")
                .or(() -> parseStringField(afterField, "created_at"))
                .flatMap(TimestampParser::parseIso8601);
    }

    @Override
    protected String getResult(JsonNode after) {
        JsonNode passesNode = after.get("passes");
        boolean passes = passesNode != null && !passesNode.isNull() && passesNode.asBoolean(false);
        if (!passes) {
            return null;
        }

        return buildPolicyDetailsJson(after);
    }

    @Override
    protected String getError(JsonNode after) {
        JsonNode passesNode = after.get("passes");
        boolean passes = passesNode != null && !passesNode.isNull() && passesNode.asBoolean(false);
        if (passes) {
            return null;
        }

        return buildPolicyDetailsJson(after);
    }

    @Override
    protected String getDetails(JsonNode after) {
        return null;
    }

    private String buildPolicyDetailsJson(JsonNode after) {
        try {
            ObjectNode detailsJson = mapper.createObjectNode();

            Policy policyInfo = getPolicyInfo(after);
            if (policyInfo != null) {
                if (policyInfo.getName() != null) {
                    detailsJson.put("policy_name", policyInfo.getName());
                }
                if (policyInfo.getQuery() != null) {
                    detailsJson.put("query", policyInfo.getQuery());
                }
                if (policyInfo.getResolution() != null) {
                    detailsJson.put("resolution", policyInfo.getResolution());
                }
                if (policyInfo.getDescription() != null) {
                    detailsJson.put("description", policyInfo.getDescription());
                }
                if (policyInfo.getCritical() != null) {
                    detailsJson.put("critical", policyInfo.getCritical());
                }
            }

            JsonNode policyIdNode = after.get("policy_id");
            if (policyIdNode != null && !policyIdNode.isNull()) {
                detailsJson.put("policy_id", policyIdNode.asInt());
            }

            JsonNode automationIterationNode = after.get("automation_iteration");
            if (automationIterationNode != null && !automationIterationNode.isNull()) {
                detailsJson.put("automation_iteration", automationIterationNode.asInt());
            }

            return mapper.writeValueAsString(detailsJson);
        } catch (Exception e) {
            log.error("Failed to create policy details JSON", e);
            return null;
        }
    }

    private String getPolicyName(JsonNode afterField) {
        Policy policyInfo = getPolicyInfo(afterField);
        return policyInfo != null ? policyInfo.getName() : null;
    }

    private Policy getPolicyInfo(JsonNode afterField) {
        JsonNode policyIdNode = afterField.get("policy_id");
        if (policyIdNode == null || policyIdNode.isNull()) {
            return null;
        }

        try {
            Long policyId = policyIdNode.asLong();
            Policy policy = fleetMdmCacheService.getPolicyById(policyId);
            if (policy == null) {
                log.debug("Policy not found in cache for policy_id: {}", policyId);
            }
            return policy;
        } catch (Exception e) {
            log.error("Error fetching policy info for policy_id: {}", policyIdNode.asText(), e);
            return null;
        }
    }
}
