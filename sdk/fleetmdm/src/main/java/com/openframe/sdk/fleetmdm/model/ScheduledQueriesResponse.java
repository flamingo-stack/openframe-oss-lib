package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/** One page of the Fleet query list, with the page info Fleet reports beside it. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduledQueriesResponse {

    private List<Query> queries;

    private Meta meta;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Meta {

        @JsonProperty("has_next_results")
        private Boolean hasNextResults;
    }
}
