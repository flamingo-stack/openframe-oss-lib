package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Body for POST /api/v1/fleet/queries/run — creates a distributed live-query campaign.
 * Either {@link #query} (ad-hoc SQL) or {@link #queryId} (existing saved query) must be provided.
 * The {@code selected} object targets hosts via host_ids, label_ids, or team_ids.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RunLiveQueryRequest {

    private String query;

    @JsonProperty("query_id")
    private Long queryId;

    private Selected selected;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Selected {
        @JsonProperty("host_ids")
        private List<Long> hostIds;

        @JsonProperty("label_ids")
        private List<Long> labelIds;

        @JsonProperty("team_ids")
        private List<Long> teamIds;
    }
}
