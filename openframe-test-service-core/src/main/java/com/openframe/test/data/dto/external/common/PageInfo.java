package com.openframe.test.data.dto.external.common;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Pagination information (cursors are ticket ids)
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PageInfo {

    private Boolean hasNextPage;

    private Boolean hasPreviousPage;

    private String startCursor;

    private String endCursor;
}
