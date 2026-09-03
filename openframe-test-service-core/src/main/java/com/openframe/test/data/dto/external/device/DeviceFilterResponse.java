package com.openframe.test.data.dto.external.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Device filter options with counts
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceFilterResponse {

    private List<DeviceFilterItem> statuses;

    private List<DeviceFilterItem> deviceTypes;

    private List<DeviceFilterItem> osTypes;

    private List<DeviceFilterItem> customerIds;

    private List<TagFilterItem> tagKeys;

    private Integer filteredCount;
}
