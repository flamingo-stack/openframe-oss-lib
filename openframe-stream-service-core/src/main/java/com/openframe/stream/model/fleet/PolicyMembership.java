package com.openframe.stream.model.fleet;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class PolicyMembership {
    @JsonProperty("policy_id")
    private Integer policyId;

    @JsonProperty("host_id")
    private Integer hostId;

    @JsonProperty("passes")
    private Boolean passes;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;

    @JsonProperty("automation_iteration")
    private Integer automationIteration;
}
