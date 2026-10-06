package com.openframe.test.data.dto.softwareaction;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Filter for softwareActionExecutions: Status and Customer; organizationIds are matched against the raw ids the rows carry.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SoftwareActionDeviceFilterInput {
    private List<String> statuses;
    private List<String> organizationIds;
}
