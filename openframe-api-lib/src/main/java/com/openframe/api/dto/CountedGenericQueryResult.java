package com.openframe.api.dto;

import lombok.*;
import lombok.experimental.SuperBuilder;

@EqualsAndHashCode(callSuper = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CountedGenericQueryResult<T> extends GenericQueryResult<T> {
    private int filteredCount;
}
