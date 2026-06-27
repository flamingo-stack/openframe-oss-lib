package com.openframe.test.data.dto.shared;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * A top-level GraphQL error entry (the `errors` array of a GraphQL response),
 * as opposed to a domain-level {@code userErrors} entry. Ticket lifecycle
 * mutations such as {@code transitionTicket} surface invalid transitions here
 * (e.g. extensions.code = "TICKET_INVALID_TRANSITION").
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class GraphqlError {
    private String message;
    private Map<String, Object> extensions;
}
