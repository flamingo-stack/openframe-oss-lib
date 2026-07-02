package com.openframe.test.data.dto.shared;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A domain-level mutation error entry (the {@code userErrors} array on a mutation
 * payload), as opposed to a top-level {@link GraphqlError}. Maps the shared
 * {@code MutationError} GraphQL type ({@code field: [String!], message: String!}).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MutationError {
    private List<String> field;
    private String message;
}