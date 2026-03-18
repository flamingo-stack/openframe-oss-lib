package com.openframe.api.dto.shared;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Relay Connection Spec pagination arguments.
 * Forward pagination: first + after
 * Backward pagination: last + before
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionArgs {

    @Min(value = 1, message = "first must be at least 1")
    @Max(value = 100, message = "first cannot exceed 100")
    private Integer first;

    private String after;

    @Min(value = 1, message = "last must be at least 1")
    @Max(value = 100, message = "last cannot exceed 100")
    private Integer last;

    private String before;
}
