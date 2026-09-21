package com.openframe.external.dto.customer;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Customer status update")
public class UpdateCustomerStatusRequest {

    @NotNull(message = "Status is required")
    @Schema(description = "New status", requiredMode = Schema.RequiredMode.REQUIRED)
    private CustomerStatusAction status;

    public enum CustomerStatusAction {
        ARCHIVED,
        ACTIVE
    }
}

