package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Tag {
    private String id;
    private String key;
    private String type;
    private String description;
    private String color;
    private String organizationId;
    private String createdAt;
    private String createdBy;
}
