package com.openframe.api.dto.device;

import jakarta.validation.Valid;
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
public class BatchAssignTagsInput {

    @NotEmpty(message = "Tags list must not be empty")
    @Valid
    private List<AssignTagInput> tags;
}
