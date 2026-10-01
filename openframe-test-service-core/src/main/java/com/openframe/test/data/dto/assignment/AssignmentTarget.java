package com.openframe.test.data.dto.assignment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// The AssignableTarget an assignment points at, by __typename; a Ticket here is assignment.graphqls' trimmed type, not the ai-agent one.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssignmentTarget {
    @JsonProperty("__typename")
    private String typename;
    private String id;
    private Integer ticketNumber;
    private String title;
    private String statusKind;
    private String name;
    private String machineId;
    private String hostname;
}
