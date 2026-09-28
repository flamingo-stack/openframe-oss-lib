package com.openframe.test.data.dto.external.log;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.openframe.test.data.dto.external.customer.CustomerFilterResponse;
import java.util.List;

/**
 * Available log filter options
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LogFilterResponse {

    private List<String> eventTypes;

    private List<String> toolTypes;

    private List<String> severities;

    private List<CustomerFilterResponse> customers;
}
