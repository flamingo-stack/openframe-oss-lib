package com.openframe.test.data.dto.softwareaction;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.FilterOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// The Software Actions page's STATUS / ACTION / ENGINE dropdowns with live counts, plus the matching total.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareActionFilters {
    private List<FilterOption> statuses;
    private List<FilterOption> actions;
    private List<FilterOption> engines;
    private Integer filteredCount;
}
