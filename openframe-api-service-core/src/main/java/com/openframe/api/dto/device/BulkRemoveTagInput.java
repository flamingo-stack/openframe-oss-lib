package com.openframe.api.dto.device;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkRemoveTagInput {

    @NotEmpty(message = "Machine IDs list must not be empty")
    private List<String> machineIds;

    @NotBlank(message = "Tag ID is required")
    private String tagId;
}
