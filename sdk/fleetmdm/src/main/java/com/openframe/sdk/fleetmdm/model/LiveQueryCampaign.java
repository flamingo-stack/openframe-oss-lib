package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a Fleet distributed live-query campaign created via POST /queries/run.
 * Results are streamed asynchronously over the live-query websocket and identified by {@link #id}.
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LiveQueryCampaign {

    @JsonProperty("id")
    private Long id;

    @JsonProperty("query_id")
    private Long queryId;

    @JsonProperty("query")
    private String query;

    @JsonProperty("status")
    private String status;

    @JsonProperty("user_id")
    private Long userId;

    @JsonProperty("created_at")
    private String createdAt;
}
