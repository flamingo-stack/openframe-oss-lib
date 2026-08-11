package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A device tag as the API returns it: a {@code key} carrying a list of {@code values}
 * ("purpose" → ["auto_test"]), not a flat name. See the {@code Tag} type in {@code tag.graphqls}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Tag {
    private String id;
    private String key;
    private List<String> values;
    private String description;
    private String color;
    private String createdAt;
}
