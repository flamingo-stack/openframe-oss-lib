package com.openframe.test.data.dto.softwareaction;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Filter for softwareActions and softwareActionFilters; enum names, null means no constraint.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SoftwareActionFilterInput {
    private List<String> statuses;
    private List<String> actions;
    private List<String> engines;
}
