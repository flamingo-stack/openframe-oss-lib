package com.openframe.api.dto.tag;

import com.openframe.data.document.tool.TagType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTagInput {

    private String description;

    private String color;

    private TagType type;

    private List<String> values;
}
