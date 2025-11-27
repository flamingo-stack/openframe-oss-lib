package com.openframe.api.dto;

import com.openframe.api.dto.shared.CursorPageInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;


@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CountedGenericConnection<T extends GenericEdge> extends GenericConnection<T> {
    private int filteredCount;
}