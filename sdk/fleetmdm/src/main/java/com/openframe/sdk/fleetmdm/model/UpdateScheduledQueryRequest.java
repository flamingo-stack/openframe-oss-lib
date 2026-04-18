package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateScheduledQueryRequest {
    private String name;
    private String query;
    private String description;
    private Integer interval;
    private String platform;
    private String logging;
}
