package com.openframe.external.dto.customer;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Customer status update")
public record UpdateCustomerStatusRequest(
        @NotNull(message = "Status is required")
        @Schema(description = "New status", requiredMode = Schema.RequiredMode.REQUIRED)
        CustomerStatusAction status
) {
    public enum CustomerStatusAction {
        ARCHIVED,
        ACTIVE
    }
}
