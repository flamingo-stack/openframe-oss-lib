package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateScheduledQueryRequest {
    private String name;
    private String query;
    private String description;
    private Integer interval;
    private String platform;

    @JsonProperty("automations_enabled")
    private Boolean automationsEnabled;

    private String logging;
}
