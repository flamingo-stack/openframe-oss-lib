package com.openframe.api.dto.tag;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTagInput {

    @NotBlank(message = "Tag key is required")
    private String key;

    private String description;

    private String color;

    private List<String> values;

    @NotBlank(message = "Organization ID is required")
    private String organizationId;
}
