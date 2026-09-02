package com.openframe.packagesearch.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackageSearchResult {

    private List<PackageSearchItem> items;
    private Integer total;
    private boolean hasMore;
}
