package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One choice offered alongside an {@link MessageDataType#ASK}, carried by {@code AskData.options}.
 *
 * <p>The options are the useful half of an ASK for a failing test: they name the alternatives the
 * router could not choose between, which is usually enough to see which way the prompt read ambiguous
 * and how to word it so the run proceeds instead of stopping to ask.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AskOption {
    private String label;
    private String description;
}
