package com.openframe.test.data.dto.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A Fleet MDM saved query. A <em>scheduled</em> query is one with {@code interval > 0}. Mirrors the fields
 * of the Fleet {@code query} object that the E2E cases assert on.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduledQuery {
    private Integer id;
    private String name;
    private String description;
    private String query;
    private Integer interval;
    private String platform;
    private Boolean saved;
}
