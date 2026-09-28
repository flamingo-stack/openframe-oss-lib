package com.openframe.test.data.dto.external.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for the External API.
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateDeviceStatusRequest {

    /** Contract values: ACTIVE, PENDING, INACTIVE, MAINTENANCE, DECOMMISSIONED, ONLINE, OFFLINE, PENDING_DELETION, DELETED, ARCHIVED. Kept as String so a new backend value deserializes rather than throwing. */
    private String status;
}
