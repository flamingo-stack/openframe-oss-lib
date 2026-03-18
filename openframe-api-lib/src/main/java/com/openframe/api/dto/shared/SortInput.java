package com.openframe.api.dto.shared;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SortInput {
    private String field;
    private SortDirection direction;

    public static SortInput from(String field, String direction) {
        if (field == null || field.trim().isEmpty()) {
            return null;
        }
        return SortInput.builder()
                .field(field)
                .direction("ASC".equalsIgnoreCase(direction) ? SortDirection.ASC : SortDirection.DESC)
                .build();
    }
}