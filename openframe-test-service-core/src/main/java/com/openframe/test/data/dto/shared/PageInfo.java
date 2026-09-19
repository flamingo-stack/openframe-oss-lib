package com.openframe.test.data.dto.shared;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Relay {@code PageInfo} as returned by every cursor-paginated connection in the
 * merged GraphQL schema.
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
