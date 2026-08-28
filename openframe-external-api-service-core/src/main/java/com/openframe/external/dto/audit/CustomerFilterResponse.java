package com.openframe.external.dto.audit;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Customer filter option with id and name")
public record CustomerFilterResponse(
        @Schema(description = "Customer id (for filtering)", example = "0b0f9f3a-9c1d-4a5e-9d55-8c9a2f6f1e42") String id,
        @Schema(description = "Customer name (for display)", example = "Acme Corporation") String name
) {
}
