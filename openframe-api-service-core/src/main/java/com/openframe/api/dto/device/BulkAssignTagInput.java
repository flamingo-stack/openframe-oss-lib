package com.openframe.api.dto.device;

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
public class BulkAssignTagInput {

    @NotEmpty(message = "Machine IDs list must not be empty")
    private List<String> machineIds;

    private String tagId;

    private String key;

    private List<String> values;
}
