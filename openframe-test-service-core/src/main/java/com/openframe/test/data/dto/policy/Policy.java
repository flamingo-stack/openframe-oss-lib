package com.openframe.test.data.dto.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Policy {
    private Integer id;
    private String name;
    private String query;
    private Boolean critical;
    private String description;

    @JsonProperty("author_id")
    private Integer authorId;

    @JsonProperty("author_name")
    private String authorName;

    @JsonProperty("author_email")
    private String authorEmail;

    @JsonProperty("team_id")
    private Integer teamId;

    private String resolution;
    private String platform;

    @JsonProperty("hosts_include_any")
    private List<Host> hostsIncludeAny;

    @JsonProperty("calendar_events_enabled")
    private Boolean calendarEventsEnabled;

    @JsonProperty("conditional_access_enabled")
    private Boolean conditionalAccessEnabled;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;

    @JsonProperty("passing_host_count")
    private Integer passingHostCount;

    @JsonProperty("failing_host_count")
    private Integer failingHostCount;

    @JsonProperty("host_count_updated_at")
    private String hostCountUpdatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Host {
        private Integer id;
        private String hostname;
    }
}
